-- ====================================================================
-- AVS DISTRIBUTION MANAGEMENT POS - MYSQL INSERTS SEEDS SCRIPT
-- Database: avs_distribution_db
-- ====================================================================

USE `avs_distribution_db`;

-- Company Info
INSERT INTO `company_info` (`id`, `name`, `subtitle`, `address`, `phone`) VALUES
(1, 'AVS DISTRIBUTORS', 'Milk & Beverage Distribution Management System', 'Main Road, Salem, Tamil Nadu', '+91 98765 43210');

-- Roles
INSERT INTO `roles` (`id`, `role_name`) VALUES
(1, 'OWNER'),
(2, 'STORE_KEEPER'),
(3, 'EMPLOYEE');

-- Users
INSERT INTO `users` (`id`, `name`, `phone`, `pin`, `role`, `vehicle_no`, `status`, `progress`) VALUES
(1, 'Tharun', '9876543210', '1111', 'EMPLOYEE', 'TN 32 XX 2222', 'On Route', 42),
(2, 'Kumar', '9876543211', '2222', 'EMPLOYEE', 'TN 32 AB 1234', 'On Route', 60),
(3, 'Suresh', '9876543212', '3333', 'EMPLOYEE', 'TN 32 CD 5678', 'Returned', 100),
(4, 'Mani', '9876543213', '4444', 'EMPLOYEE', 'TN 32 BF 9012', 'On Route', 20),
(5, 'Prakash', '9876543214', '5555', 'EMPLOYEE', 'TN 32 GH 3456', 'Not Started', 0),
(6, 'Store Keeper', '9876543200', '1234', 'STORE_KEEPER', NULL, 'Active', 100),
(7, 'Owner Admin', '9999999999', '9999', 'OWNER', NULL, 'Active', 100);

-- Routes
INSERT INTO `routes` (`id`, `name`, `shops_count`, `completed_count`) VALUES
(1, 'Route A (Salem Main)', 30, 12);

-- Products Master (15 Variants + Rate Engine Data)
INSERT INTO `products` (`id`, `name`, `display_name`, `category`, `base_unit`, `selling_unit`, `pieces_per_unit`, `purchase_price`, `unit_selling_price`, `piece_selling_price`, `warehouse_stock_units`, `icon`, `image_path`) VALUES
(1, 'Amirtha Milk 200ml', 'Amirtha Milk - 200ml', 'Dairy', 'Piece', 'Tray', 20, 720.00, 880.00, 44.00, 88, '🥛', '/images/amirthaa_milk_200ml.png'),
(5, 'Amirtha Milk 500ml', 'Amirtha Milk - 500ml', 'Dairy', 'Piece', 'Tray', 12, 780.00, 960.00, 80.00, 110, '🥛', '/images/amirthaa_milk_500ml.png'),
(6, 'Amirtha Milk 1L', 'Amirtha Milk - 1L', 'Dairy', 'Piece', 'Tray', 10, 850.00, 1050.00, 105.00, 65, '🥛', '/images/amirthaa_milk_1l.jpg'),
(7, 'Amirtha Curd 200ml', 'Amirtha Curd - 200ml', 'Curd', 'Piece', 'Tray', 20, 520.00, 660.00, 33.00, 75, '🥣', '/images/amirthaa_curd_200ml.jpg'),
(8, 'Amirtha Curd 500ml', 'Amirtha Curd - 500ml', 'Curd', 'Piece', 'Tray', 12, 620.00, 780.00, 65.00, 90, '🥣', '/images/amirthaa_curd_500ml.jpg'),
(9, 'Amirtha Curd 1L', 'Amirtha Curd - 1L', 'Curd', 'Piece', 'Tray', 10, 760.00, 950.00, 95.00, 40, '🥣', '/images/amirthaa_curd_1l.jpg'),
(10, 'Coccola 200ml', 'Coccola - 200ml', 'Beverage', 'Piece', 'Box', 24, 480.00, 600.00, 25.00, 140, '🥤', '/images/coccola_200ml.png'),
(3, 'Coccola 500ml', 'Coccola - 500ml', 'Beverage', 'Piece', 'Box', 12, 540.00, 720.00, 60.00, 120, '🥤', '/images/coccola_500ml.png'),
(11, 'Coccola 1L', 'Coccola - 1L', 'Beverage', 'Piece', 'Box', 6, 420.00, 570.00, 95.00, 80, '🥤', '/images/coccola_1l.png'),
(12, 'Juice Pack 200ml', 'Juice Pack - 200ml', 'Juice', 'Piece', 'Box', 24, 400.00, 520.00, 22.00, 95, '🧃', '/images/juice_hero.jpg'),
(15, 'Tata Drink 200ml', 'Tata Drink - 200ml', 'Juice', 'Piece', 'Box', 24, 380.00, 480.00, 20.00, 110, '🧃', '/images/tata_hero.jpg'),
(18, 'Aquafresh Water 200ml', 'Aquafresh Water - 200ml', 'Water', 'Piece', 'Box', 48, 200.00, 280.00, 6.00, 210, '💧', '/images/aquafresh_water_200ml.png'),
(19, 'Aquafresh Water 500ml', 'Aquafresh Water - 500ml', 'Water', 'Piece', 'Box', 24, 240.00, 340.00, 14.00, 180, '💧', '/images/aquafresh_water_500ml.png'),
(2, 'Aquafresh Water 1L', 'Aquafresh Water - 1L', 'Water', 'Piece', 'Box', 12, 280.00, 380.00, 32.00, 250, '💧', '/images/aquafresh_water_1l.png'),
(20, 'Aquafresh Water 2L', 'Aquafresh Water - 2L', 'Water', 'Piece', 'Box', 6, 220.00, 300.00, 50.00, 90, '💧', '/images/aquafresh_water_2l.png');

-- Shops Master (6 Retail Stores)
INSERT INTO `shops` (`id`, `code`, `name`, `owner_name`, `phone`, `distance`, `route_id`, `current_due`, `completed`, `has_freezer`, `freezer_model`, `freezer_serial`, `freezer_date`, `freezer_status`) VALUES
(102, '#102', 'Mani Store', 'Manikandan', '9123456789', '2.3 km', 1, 1200.00, 0, 1, 'Blue Star 300L Deep Freezer', 'FRZ-MS-102', '2026-01-10', 'Active'),
(103, '#103', 'Kumar Store', 'Kumar', '9123456788', '2.8 km', 1, 800.00, 0, 0, NULL, NULL, NULL, NULL),
(104, '#104', 'Raja Store', 'Rajesh', '9123456787', '3.1 km', 1, 0.00, 0, 1, 'Voltas 400L Double Door Cooler', 'FRZ-RS-104', '2026-02-20', 'Active'),
(105, '#105', 'Siva Store', 'Sivakumar', '9123456786', '3.4 km', 1, 450.00, 0, 0, NULL, NULL, NULL, NULL),
(106, '#106', 'New Super Store', 'Periasamy', '9123456785', '4.0 km', 1, 0.00, 0, 1, 'Haier 320L Visicooler', 'FRZ-NSS-106', '2026-03-05', 'Active'),
(107, '#107', 'Green Park Bakery', 'Karthik', '9123456784', '4.5 km', 1, 0.00, 0, 0, NULL, NULL, NULL, NULL);

-- Employee Stock Allocations
INSERT INTO `employee_stock` (`employee_id`, `product_id`, `qty_units`, `unit`) VALUES
(1, 1, 8, 'Tray'),
(1, 2, 5, 'Tray'),
(1, 3, 5, 'Box'),
(1, 4, 15, 'Pack');

-- Initial Sales Records
INSERT INTO `sales` (`id`, `bill_no`, `employee_id`, `employee_name`, `shop_id`, `shop_name`, `date`, `time`, `total_amount`, `payment_mode`) VALUES
(1, 'INV-10921', 1, 'Tharun (Driver)', 102, 'Mani Store', CURDATE(), '09:30 AM', 1800.00, 'CASH'),
(2, 'INV-10922', 1, 'Tharun (Driver)', 103, 'Kumar Store', CURDATE(), '10:15 AM', 950.00, 'GPAY'),
(3, 'INV-10923', 2, 'Kumar (Driver)', 104, 'Raja Store', CURDATE(), '11:00 AM', 2400.00, 'CREDIT'),
(4, 'INV-10924', 6, 'Store Keeper', 105, 'Siva Store', CURDATE(), '01:45 PM', 1250.00, 'SPLIT');

-- Sale Items Breakdown
INSERT INTO `sale_items` (`sale_id`, `product_id`, `product_name`, `qty`, `unit_type`, `rate`, `amount`) VALUES
(1, 1, 'Amirtha Milk 200ml', 2.00, 'Tray', 880.00, 1760.00),
(2, 5, 'Amirtha Milk 500ml', 1.00, 'Tray', 960.00, 960.00),
(3, 3, 'Coccola 500ml', 4.00, 'Box', 720.00, 2880.00);

-- System Audit Log Activities
INSERT INTO `recent_activities` (`id`, `title`, `time`, `type`) VALUES
(1, 'Database schema and seeds setup completed', '10:00 AM', 'system'),
(2, 'Price master rates updated by Owner Admin', '10:15 AM', 'price'),
(3, 'Freezer assigned to Mani Store (#102)', '10:30 AM', 'freezer');
