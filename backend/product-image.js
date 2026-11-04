export function uploadedProductImage(value) {
  if(value===null||value==='')return null;
  if(typeof value!=='string'||value.length>400000)throw Error('Product image is too large. Select the image again.');
  const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if(!match)throw Error('Choose a JPG, PNG or WebP product image.');
  const bytes=Buffer.from(match[2],'base64');
  if(bytes.toString('base64')!==match[2])throw Error('Invalid product image.');
  const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)throw Error('Invalid product image format.');
  return value;
}
