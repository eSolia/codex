-- Migration: Add contact name to proposals
-- Allows specifying recipient contact person for "Prepared for: Name, Company" format

ALTER TABLE proposals ADD COLUMN contact_name TEXT;

-- InfoSec: No sensitive data - just display name for proposal addressing
