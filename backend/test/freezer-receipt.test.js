import test from 'node:test';
import assert from 'node:assert/strict';
import pg from '../node_modules/pg/lib/index.js';
import {freezerReceiptSQL,freezerReceiptHandler} from '../freezer-receipt.js';
test('freezer receipt excludes unassigned, inactive and foreign shops; retains each asset and legacy assignments',async()=>{
 const c=new pg.Client({host:'127.0.0.1',port:55439,user:'avs_test_admin',database:'postgres'});await c.connect();
 try{await c.query('SET search_path TO pg_temp');
 await c.query(`
 CREATE TEMP TABLE routes(id int,company_id int,is_active bool);
 CREATE TEMP TABLE villages(id int,company_id int,route_id int);
 CREATE TEMP TABLE shops(id int,company_id int,name text,phone text,is_active bool,village_id int,route_id int,has_freezer bool,freezer_serial text,freezer_model text);
 CREATE TEMP TABLE shop_freezers(id int,shop_id int,company_id int,serial_no text,model_name text);
 INSERT INTO routes VALUES(1,1,true),(2,1,true),(3,2,true);
 INSERT INTO villages VALUES(1,1,1);
 INSERT INTO shops VALUES(1,1,'Assigned','123',true,1,2,true,'old','Old model'),(2,1,'Unassigned','456',true,null,1,false,null,null),(3,2,'Foreign','789',true,null,1,true,'foreign','Foreign'),(4,1,'Legacy','999',true,null,1,true,'LEG','Legacy type'),(5,1,'Inactive','000',false,null,1,true,'OFF','Off');
 INSERT INTO shop_freezers VALUES(10,1,1,'FR1','Blue Star 300L'),(11,1,1,'FR2','Voltas 200L'),(12,3,2,'FOREIGN','Other');
 `);
 const rows=(await c.query(freezerReceiptSQL,[1,1])).rows;
 assert.deepEqual(rows.map(r=>r.freezer_id),['FR1','FR2','LEG']);assert.equal(rows[0].contact,'123');
 assert.equal((await c.query(freezerReceiptSQL,[1,2])).rows.length,0);
 }finally{await c.end();}
});
test('invalid route never reaches DB',async()=>{
 let queries=0;const h=freezerReceiptHandler(async()=>{queries++;});const res={status(n){this.code=n;return this;},json(){}};
 await h({params:{routeId:'1 OR 1=1'}},res,()=>{});assert.equal(res.code,400);assert.equal(queries,0);
});
