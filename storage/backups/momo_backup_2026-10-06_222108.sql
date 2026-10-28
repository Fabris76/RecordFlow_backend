-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: momo_business_db
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` int DEFAULT NULL,
  `description` varchar(500) NOT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_created_at` (`created_at`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `backups`
--

DROP TABLE IF EXISTS `backups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `backups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `file_size` bigint NOT NULL,
  `created_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(30) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_backup_filename` (`filename`),
  KEY `created_by` (`created_by`),
  KEY `idx_backups_created_at` (`created_at`),
  KEY `idx_backups_status` (`status`),
  CONSTRAINT `backups_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `backups`
--

LOCK TABLES `backups` WRITE;
/*!40000 ALTER TABLE `backups` DISABLE KEYS */;
/*!40000 ALTER TABLE `backups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `balance_history`
--

DROP TABLE IF EXISTS `balance_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `balance_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendor_id` int NOT NULL,
  `balance_type` enum('CASH','MOMO') NOT NULL,
  `change_amount` decimal(12,2) NOT NULL,
  `previous_balance` decimal(12,2) NOT NULL,
  `new_balance` decimal(12,2) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_id` int DEFAULT NULL,
  `changed_by` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `changed_by` (`changed_by`),
  KEY `idx_history_vendor` (`vendor_id`),
  KEY `idx_history_type` (`balance_type`),
  KEY `idx_history_date` (`created_at`),
  CONSTRAINT `balance_history_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `balance_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `balance_history`
--

LOCK TABLES `balance_history` WRITE;
/*!40000 ALTER TABLE `balance_history` DISABLE KEYS */;
INSERT INTO `balance_history` VALUES (1,6,'CASH',100.00,0.00,100.00,'Workflow test funding','MANUAL_ADJUSTMENT',NULL,5,'2026-10-06 14:57:48'),(2,6,'MOMO',100.00,0.00,100.00,'Workflow test funding','MANUAL_ADJUSTMENT',NULL,5,'2026-10-06 14:57:48');
/*!40000 ALTER TABLE `balance_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `daily_closing`
--

DROP TABLE IF EXISTS `daily_closing`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `daily_closing` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendor_id` int NOT NULL,
  `closing_date` date NOT NULL,
  `total_transactions` int NOT NULL DEFAULT '0',
  `total_deposits` decimal(12,2) DEFAULT '0.00',
  `total_withdrawals` decimal(12,2) DEFAULT '0.00',
  `total_transfers` decimal(12,2) DEFAULT '0.00',
  `total_airtime` decimal(12,2) DEFAULT '0.00',
  `total_data` decimal(12,2) DEFAULT '0.00',
  `total_bill_payments` decimal(12,2) DEFAULT '0.00',
  `total_other` decimal(12,2) DEFAULT '0.00',
  `total_amount` decimal(12,2) DEFAULT '0.00',
  `status` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  `closed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_closing` (`vendor_id`,`closing_date`),
  KEY `idx_closing_vendor_date` (`vendor_id`,`closing_date`),
  KEY `idx_closing_status` (`status`),
  CONSTRAINT `daily_closing_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `daily_closing`
--

LOCK TABLES `daily_closing` WRITE;
/*!40000 ALTER TABLE `daily_closing` DISABLE KEYS */;
INSERT INTO `daily_closing` VALUES (1,6,'2026-10-06',0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,'CLOSED','2026-10-06 14:58:35','2026-10-06 14:58:35','2026-10-06 14:58:35'),(2,4,'2026-10-06',0,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,'CLOSED','2026-10-06 15:42:38','2026-10-06 15:42:38','2026-10-06 15:42:38');
/*!40000 ALTER TABLE `daily_closing` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `recipient_id` int NOT NULL,
  `type` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` varchar(500) NOT NULL,
  `entity_type` varchar(50) DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_recipient` (`recipient_id`,`created_at`),
  KEY `idx_notifications_is_read` (`is_read`),
  KEY `idx_notifications_type` (`type`),
  KEY `idx_notifications_created_at` (`created_at`),
  KEY `idx_notifications_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`recipient_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notifications`
--

LOCK TABLES `notifications` WRITE;
/*!40000 ALTER TABLE `notifications` DISABLE KEYS */;
INSERT INTO `notifications` VALUES (1,1,'VENDOR_CREATED','New Vendor Added','Fabris has been added as a vendor.','VENDOR',3,1,'2026-09-13 05:12:11','2026-10-06 22:18:51'),(2,1,'VENDOR_DEACTIVATED','Vendor Deactivated','Test Vendor\'s account has been inactive.','VENDOR',2,1,'2026-09-13 05:20:39','2026-10-06 22:19:48'),(3,1,'VENDOR_ACTIVATED','Vendor Activated','Test Vendor\'s account has been active.','VENDOR',2,1,'2026-09-28 11:01:01','2026-10-06 22:19:52'),(4,1,'VENDOR_DEACTIVATED','Vendor Deactivated','Test Vendor\'s account has been inactive.','VENDOR',2,1,'2026-09-28 11:01:34','2026-10-06 22:19:53'),(5,1,'VENDOR_CREATED','New Vendor Added','VendorA has been added as a vendor.','VENDOR',4,1,'2026-09-28 12:09:26','2026-10-06 22:19:59'),(6,1,'BALANCE_ADJUSTED','Balance Adjusted','Cash balance for Workflow Test Vendor was adjusted by GHS 100.00.','BALANCE',6,1,'2026-10-06 14:57:48','2026-10-06 22:20:02'),(7,1,'BALANCE_ADJUSTED','Balance Adjusted','MoMo balance for Workflow Test Vendor was adjusted by GHS 100.00.','BALANCE',6,1,'2026-10-06 14:57:48','2026-10-06 22:20:02'),(8,1,'DAILY_CLOSING_COMPLETED','Daily Closing Completed','Workflow Test Vendor completed the daily closing for October 6, 2026.','DAILY_CLOSING',1,1,'2026-10-06 14:58:35','2026-10-06 22:20:02'),(9,1,'DAILY_CLOSING_COMPLETED','Daily Closing Completed','VendorA completed the daily closing for October 6, 2026.','DAILY_CLOSING',2,1,'2026-10-06 15:42:38','2026-10-06 22:20:02');
/*!40000 ALTER TABLE `notifications` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_history`
--

DROP TABLE IF EXISTS `transaction_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_id` int NOT NULL,
  `field_name` varchar(100) NOT NULL,
  `old_value` text,
  `new_value` text,
  `changed_by` int NOT NULL,
  `changed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_history_transaction` (`transaction_id`,`changed_at`),
  KEY `idx_history_changed_by` (`changed_by`),
  CONSTRAINT `transaction_history_ibfk_1` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`),
  CONSTRAINT `transaction_history_ibfk_2` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_history`
--

LOCK TABLES `transaction_history` WRITE;
/*!40000 ALTER TABLE `transaction_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `transaction_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transaction_reference` varchar(50) DEFAULT NULL,
  `vendor_id` int NOT NULL,
  `type` enum('DEPOSIT','WITHDRAWAL','TRANSFER','AIRTIME','DATA','BILL_PAYMENT','OTHER') NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `customer_reference` varchar(100) DEFAULT NULL,
  `transaction_date` date NOT NULL,
  `transaction_time` time NOT NULL,
  `status` enum('COMPLETED','PENDING','FAILED') NOT NULL DEFAULT 'COMPLETED',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transaction_reference` (`transaction_reference`),
  KEY `idx_transactions_vendor_date` (`vendor_id`,`transaction_date`),
  KEY `idx_transactions_type_status` (`type`,`status`),
  KEY `idx_transactions_created_at` (`created_at`),
  KEY `idx_transactions_amount` (`amount`),
  KEY `idx_transactions_transaction_reference` (`transaction_reference`),
  CONSTRAINT `transactions_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('OWNER','VENDOR') NOT NULL DEFAULT 'VENDOR',
  `status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `phone_2` (`phone`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'Business Owner','0240000000','$2b$10$mERjoVLGHAS6xZl/6vkCmOXFASFfpEvgEYx0RRhmL.s2kPCORb9mG','OWNER','ACTIVE','2026-09-13 04:55:10','2026-09-13 04:55:10'),(2,'Test Vendor','0241111111','$2b$10$WPuV5uoNkO0FlAzc183sN.Vh0lgU2JUTqeV9UzeucEaBnTGxGnsHC','VENDOR','INACTIVE','2026-09-13 04:55:10','2026-09-28 11:01:34'),(3,'Fabris','0594666648','$2b$10$brJXQUbnRc0GQ5Cy8XbKGuBFLsl7EsRUvA.md8/UNxvyV8YdA7aRS','VENDOR','ACTIVE','2026-09-13 05:12:11','2026-09-13 05:12:11'),(4,'VendorA','0242222222','$2b$10$kuMAHxnhrITXi5V7egWr2ubNNrx62cuSjUgcXQxWZ220ynJofNkSK','VENDOR','ACTIVE','2026-09-28 12:09:26','2026-09-28 12:09:26'),(5,'Workflow Test Owner','0550003101','$2b$10$OMty72BMyrv/EvreyhnWVemJJrIbfDUSlRmOSuSeYo1qfGmcLo0K2','OWNER','ACTIVE','2026-10-06 14:54:42','2026-10-06 14:54:42'),(6,'Workflow Test Vendor','0550003102','$2b$10$NqOvf6bsnZh.uI8XghlaA.2cTuTs3lvPmmEykMKneJP7szSb3Q8/u','VENDOR','ACTIVE','2026-10-06 14:56:23','2026-10-06 14:56:23');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendor_balances`
--

DROP TABLE IF EXISTS `vendor_balances`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendor_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendor_id` int NOT NULL,
  `cash_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `momo_balance` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_balance` (`vendor_id`),
  CONSTRAINT `vendor_balances_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendor_balances`
--

LOCK TABLES `vendor_balances` WRITE;
/*!40000 ALTER TABLE `vendor_balances` DISABLE KEYS */;
INSERT INTO `vendor_balances` VALUES (1,2,0.00,0.00,'2026-09-13 04:55:10','2026-09-13 04:55:10'),(2,3,0.00,0.00,'2026-09-13 05:12:11','2026-09-13 05:12:11'),(3,4,0.00,0.00,'2026-09-28 12:09:26','2026-09-28 12:09:26'),(4,6,100.00,100.00,'2026-10-06 14:56:23','2026-10-06 14:57:48');
/*!40000 ALTER TABLE `vendor_balances` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vendors`
--

DROP TABLE IF EXISTS `vendors`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vendors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `vendors_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vendors`
--

LOCK TABLES `vendors` WRITE;
/*!40000 ALTER TABLE `vendors` DISABLE KEYS */;
INSERT INTO `vendors` VALUES (1,2,'2026-09-13 04:55:10','2026-09-13 04:55:10'),(2,3,'2026-09-13 05:12:11','2026-09-13 05:12:11'),(3,4,'2026-09-28 12:09:26','2026-09-28 12:09:26');
/*!40000 ALTER TABLE `vendors` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'momo_business_db'
--

--
-- Dumping routines for database 'momo_business_db'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-06 22:21:11
