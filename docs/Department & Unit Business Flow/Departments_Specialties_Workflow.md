# ZypoCare HIMS - Requirement 2.3 Workflow
# Departments & Specialties Management System

**Document Version:** 1.0  
**Date:** February 6, 2026  
**Module:** Infrastructure Setup - Departments & Specialties  
**Reference:** ZypoCare Infrastructure PRD Phase 1 - Section 2.3 & 2.4

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Data Model & Relationships](#2-data-model--relationships)
3. [System Initialization Workflow](#3-system-initialization-workflow)
4. [Department Management Workflow](#4-department-management-workflow)
5. [Units, Rooms & Resources Workflow](#5-units-rooms--resources-workflow)
6. [Integration Points](#6-integration-points)
7. [Business Rules & Validations](#7-business-rules--validations)
8. [User Roles & Permissions](#8-user-roles--permissions)
9. [API Specifications](#9-api-specifications)
10. [UI/UX Flow](#10-uiux-flow)

---

## 1. System Overview

### 1.1 Purpose
The Departments & Specialties module enables hospitals to configure their clinical and administrative organization structure, linking physical infrastructure (buildings, floors, units) with clinical capabilities (specialties) and resources (beds, equipment).

### 1.2 Key Components
```
┌─────────────────────────────────────────────────────────────────┐
│                  DEPARTMENTS & SPECIALTIES SYSTEM                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │ SPECIALTY MASTER │───▶│   DEPARTMENTS    │───▶│   UNITS   │  │
│  │  (Pre-loaded)    │    │  (Configured)    │    │(Physical) │  │
│  └──────────────────┘    └──────────────────┘    └───────────┘  │
│           │                       │                      │        │
│           │                       │                      │        │
│           ▼                       ▼                      ▼        │
│  ┌──────────────────┐    ┌──────────────────┐    ┌───────────┐  │
│  │ 150+ MCI-        │    │ Staff Assignment │    │   ROOMS   │  │
│  │ Recognized       │    │ Location Mapping │    │   BEDS    │  │
│  │ Specialties      │    │ Service Catalog  │    │ RESOURCES │  │
│  └──────────────────┘    └──────────────────┘    └───────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Scope
- **In Scope:**
  - Specialty master data management (pre-loaded, MCI-recognized)
  - Department creation and configuration
  - Specialty-to-department assignment (many-to-many)
  - Unit type configuration
  - Room and resource management
  - Department-location hierarchy mapping
  - Staff assignment to departments
  - Operating hours configuration

- **Out of Scope (Handled by Other Modules):**
  - Staff credentials and privileges (Staff Management Module)
  - Service catalog items (Service Catalog Module)
  - Billing and tariff configuration (Billing Module)
  - Appointment scheduling (OPD Module)
  - Bed occupancy tracking (IPD Module)

---

## 2. Data Model & Relationships

### 2.1 Core Entities

#### 2.1.1 Specialty Master
```typescript
interface Specialty {
  id: string;                      // UUID
  code: string;                    // e.g., "MED-001", "SUR-002"
  name: string;                    // e.g., "General Medicine"
  category: SpecialtyCategory;     // CLINICAL, SUPER_SPECIALTY
  mciRecognized: boolean;          // true for all pre-loaded
  parentSpecialty?: string;        // For super-specialties
  description: string;
  commonProcedures: string[];      // Common procedures in specialty
  commonDiagnoses: string[];       // ICD-10 codes commonly seen
  requiredEquipment: string[];     // Standard equipment needed
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isSystemDefined: boolean;        // true for pre-loaded, false for custom
}

enum SpecialtyCategory {
  CLINICAL = 'CLINICAL',                    // General specialties
  SUPER_SPECIALTY = 'SUPER_SPECIALTY',      // Advanced specializations
  ALLIED_HEALTH = 'ALLIED_HEALTH',          // Physio, Dietetics, etc.
  DIAGNOSTIC = 'DIAGNOSTIC',                // Radiology, Pathology
  EMERGENCY = 'EMERGENCY',                   // Emergency Medicine
  CRITICAL_CARE = 'CRITICAL_CARE'           // ICU specialties
}
```

#### 2.1.2 Department
```typescript
interface Department {
  id: string;
  branchId: string;                // FK to Branch
  code: string;                    // Unique within branch, e.g., "DEPT-OPD-001"
  name: string;                    // e.g., "Cardiology OPD"
  description?: string;
  
  // Classification
  facilityType: FacilityType;      // CLINICAL, SERVICE, SUPPORT
  departmentType: DepartmentType;  // OPD, IPD, ICU, OT, ER, DIAGNOSTIC, etc.
  
  // Specialty Mapping (Many-to-Many)
  specialties: SpecialtyAssignment[];
  
  // Physical Location
  locationId: string;              // FK to Location Hierarchy
  locationPath: string;            // e.g., "Main Building > 2nd Floor > East Wing"
  
  // Organization
  headOfDepartment?: string;       // FK to Staff
  parentDepartmentId?: string;     // For sub-departments
  
  // Contact
  contactExtension?: string;
  contactEmail?: string;
  
  // Operations
  operatingHours: OperatingHours;
  is24x7: boolean;
  isEmergency: boolean;
  
  // Status
  isActive: boolean;
  activationDate: Date;
  deactivationDate?: Date;
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

enum FacilityType {
  CLINICAL = 'CLINICAL',           // Patient care departments
  SERVICE = 'SERVICE',             // Support services (Lab, Radiology)
  SUPPORT = 'SUPPORT'              // Admin, HR, Maintenance
}

enum DepartmentType {
  OUTPATIENT = 'OUTPATIENT',       // OPD
  INPATIENT = 'INPATIENT',         // IPD
  INTENSIVE_CARE = 'INTENSIVE_CARE', // ICU, ICCU, NICU
  OPERATION_THEATRE = 'OPERATION_THEATRE',
  EMERGENCY = 'EMERGENCY',
  DIAGNOSTIC = 'DIAGNOSTIC',       // Lab, Radiology
  PHARMACY = 'PHARMACY',
  BLOOD_BANK = 'BLOOD_BANK',
  PHYSIOTHERAPY = 'PHYSIOTHERAPY',
  DIETARY = 'DIETARY',
  CSSD = 'CSSD',
  MEDICAL_RECORDS = 'MEDICAL_RECORDS',
  BILLING = 'BILLING',
  ADMINISTRATION = 'ADMINISTRATION',
  MAINTENANCE = 'MAINTENANCE'
}

interface SpecialtyAssignment {
  specialtyId: string;             // FK to Specialty
  isPrimary: boolean;              // One primary specialty per department
  servicesOffered: string[];       // Service IDs from Service Catalog
  staffCount?: number;             // Optional capacity planning
  assignedDate: Date;
}

interface OperatingHours {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface DaySchedule {
  isOpen: boolean;
  shifts: TimeSlot[];
}

interface TimeSlot {
  startTime: string;               // HH:mm format
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
}
```

#### 2.1.3 Unit
```typescript
interface Unit {
  id: string;
  branchId: string;
  departmentId: string;            // FK to Department
  
  code: string;                    // e.g., "UNIT-ICU-001"
  name: string;                    // e.g., "ICU - A Block"
  
  // Unit Type (from pre-configured catalog)
  unitType: UnitType;              // Reference to UnitTypeCatalog
  
  // Physical Location
  locationId: string;              // FK to Location
  floorNumber?: number;
  wingZone?: string;
  
  // Capacity
  totalBedCapacity?: number;       // For bed-based units
  totalRoomCount: number;
  
  // Capabilities
  canScheduleAppointments: boolean; // From UnitType
  requiresBedAssignment: boolean;   // From UnitType
  hasRooms: boolean;                // From UnitType
  
  // Staff
  inchargeStaffId?: string;        // Unit in-charge
  nursingStationLocation?: string;
  
  // Status
  isActive: boolean;
  commissionedDate: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

interface UnitType {
  code: string;                    // e.g., "OPD", "ICU", "IPD_PVT"
  name: string;
  category: UnitCategory;
  
  // Characteristics
  hasRooms: boolean;
  isSchedulable: boolean;
  isBedBased: boolean;
  requiresPreAuth: boolean;        // For insurance units
  
  // Default Configuration
  defaultOperatingHours: OperatingHours;
  standardEquipment: string[];
  
  isSystemDefined: boolean;
}

enum UnitCategory {
  OUTPATIENT = 'OUTPATIENT',
  INPATIENT = 'INPATIENT',
  CRITICAL_CARE = 'CRITICAL_CARE',
  PROCEDURE = 'PROCEDURE',
  DIAGNOSTIC = 'DIAGNOSTIC',
  SUPPORT = 'SUPPORT'
}
```

#### 2.1.4 Room
```typescript
interface Room {
  id: string;
  unitId: string;                  // FK to Unit
  
  code: string;                    // e.g., "RM-ICU-A-101"
  name: string;                    // e.g., "ICU Room 101"
  roomNumber: string;              // Display number
  
  roomType: RoomType;
  
  // Physical Attributes
  areaSqFt: number;
  hasAttachedBathroom: boolean;
  hasAC: boolean;
  hasTV: boolean;
  hasOxygen: boolean;
  hasSuction: boolean;
  hasVentilator: boolean;
  hasMonitoring: boolean;
  hasCallButton: boolean;
  
  // Capacity
  maxOccupancy: number;            // Maximum beds/resources
  currentOccupancy: number;        // Runtime tracking
  
  // Pricing
  pricingTier: PricingTier;
  baseChargePerDay?: number;       // Optional default rate
  
  // Isolation/Special
  isIsolation: boolean;
  isolationType?: IsolationType;
  
  // Status
  isActive: boolean;
  isAvailable: boolean;            // Runtime availability
  maintenanceStatus?: MaintenanceStatus;
  lastCleanedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

enum RoomType {
  CONSULTATION = 'CONSULTATION',
  PROCEDURE = 'PROCEDURE',
  EXAMINATION = 'EXAMINATION',
  PATIENT_ROOM = 'PATIENT_ROOM',
  ISOLATION = 'ISOLATION',
  NEGATIVE_PRESSURE = 'NEGATIVE_PRESSURE',
  POSITIVE_PRESSURE = 'POSITIVE_PRESSURE',
  NURSING_STATION = 'NURSING_STATION',
  WAITING = 'WAITING',
  STORAGE = 'STORAGE',
  UTILITY = 'UTILITY',
  RECOVERY = 'RECOVERY'
}

enum PricingTier {
  ECONOMY = 'ECONOMY',
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  SUITE = 'SUITE',
  VIP = 'VIP'
}

enum IsolationType {
  CONTACT = 'CONTACT',
  DROPLET = 'DROPLET',
  AIRBORNE = 'AIRBORNE',
  PROTECTIVE = 'PROTECTIVE'
}

enum MaintenanceStatus {
  OPERATIONAL = 'OPERATIONAL',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  CLEANING_IN_PROGRESS = 'CLEANING_IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE'
}
```

#### 2.1.5 Resource (Bed/Equipment)
```typescript
interface Resource {
  id: string;
  roomId?: string;                 // FK to Room (null for mobile resources)
  unitId: string;                  // FK to Unit
  
  code: string;                    // e.g., "BED-ICU-A-101-1"
  name: string;
  assetTag?: string;               // Physical asset tag
  
  resourceType: ResourceType;
  resourceCategory: ResourceCategory;
  
  // Specifications
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  
  // Capabilities
  hasMonitoring: boolean;
  hasOxygenSupply: boolean;
  hasSuctionSupply: boolean;
  hasVentilatorSupport: boolean;
  isPowerRequired: boolean;
  
  // State Management
  currentState: ResourceState;
  isAvailable: boolean;            // Computed from state
  assignedPatientId?: string;      // Current patient (if occupied)
  
  // Scheduling (for schedulable resources)
  isSchedulable: boolean;
  slotDuration?: number;           // minutes
  
  // Maintenance
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  warrantyExpiryDate?: Date;
  
  // Status
  isActive: boolean;
  commissionedDate: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

enum ResourceType {
  // Bed Resources
  GENERAL_BED = 'GENERAL_BED',
  ICU_BED = 'ICU_BED',
  NICU_INCUBATOR = 'NICU_INCUBATOR',
  CRIB = 'CRIB',
  TROLLEY = 'TROLLEY',
  STRETCHER = 'STRETCHER',
  WHEELCHAIR_POSITION = 'WHEELCHAIR_POSITION',
  
  // Procedure Resources
  OT_TABLE = 'OT_TABLE',
  DIALYSIS_STATION = 'DIALYSIS_STATION',
  CHEMOTHERAPY_CHAIR = 'CHEMOTHERAPY_CHAIR',
  PROCEDURE_CHAIR = 'PROCEDURE_CHAIR',
  RECOVERY_BAY = 'RECOVERY_BAY',
  DENTAL_CHAIR = 'DENTAL_CHAIR',
  
  // Diagnostic Resources
  XRAY_MACHINE_SLOT = 'XRAY_MACHINE_SLOT',
  CT_SCANNER_SLOT = 'CT_SCANNER_SLOT',
  MRI_SCANNER_SLOT = 'MRI_SCANNER_SLOT',
  USG_MACHINE_SLOT = 'USG_MACHINE_SLOT',
  ECG_MACHINE_SLOT = 'ECG_MACHINE_SLOT',
  ECHO_MACHINE_SLOT = 'ECHO_MACHINE_SLOT',
  SAMPLE_COLLECTION_COUNTER = 'SAMPLE_COLLECTION_COUNTER',
  
  // Other
  CONSULTATION_SLOT = 'CONSULTATION_SLOT',
  EXAMINATION_TABLE = 'EXAMINATION_TABLE'
}

enum ResourceCategory {
  BED = 'BED',
  PROCEDURE = 'PROCEDURE',
  DIAGNOSTIC = 'DIAGNOSTIC',
  CONSULTATION = 'CONSULTATION',
  OTHER = 'OTHER'
}

enum ResourceState {
  AVAILABLE = 'AVAILABLE',         // Ready for use
  OCCUPIED = 'OCCUPIED',           // In use
  RESERVED = 'RESERVED',           // Booked but not yet occupied
  CLEANING = 'CLEANING',           // Housekeeping in progress
  MAINTENANCE = 'MAINTENANCE',     // Under repair
  BLOCKED = 'BLOCKED',             // Temporarily unavailable
  INACTIVE = 'INACTIVE',           // Decommissioned
  SANITIZATION = 'SANITIZATION'    // Post-discharge cleaning
}
```

### 2.2 Entity Relationship Diagram

```
┌──────────────────┐
│    BRANCH        │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────┐
│   LOCATION       │
│   HIERARCHY      │
└────────┬─────────┘
         │
         │ 1:N
         │
┌────────▼─────────────────────────────────────┐
│           DEPARTMENT                         │
│  ┌──────────────────────────────────────┐   │
│  │ Specialties (M:N)                    │   │
│  │ ├─ Cardiology (Primary)              │   │
│  │ ├─ Internal Medicine (Secondary)     │   │
│  │ └─ Endocrinology (Secondary)         │   │
│  └──────────────────────────────────────┘   │
└─────────┬────────────────────────────────────┘
          │
          │ 1:N
          │
┌─────────▼─────────┐
│       UNIT        │
│   (ICU, OPD,      │
│    Ward, etc.)    │
└─────────┬─────────┘
          │
          │ 1:N
          │
┌─────────▼─────────┐
│       ROOM        │
│   (Physical       │
│    spaces)        │
└─────────┬─────────┘
          │
          │ 1:N
          │
┌─────────▼─────────┐
│     RESOURCE      │
│  (Beds, Tables,   │
│   Equipment)      │
└───────────────────┘


┌──────────────────┐
│ SPECIALTY MASTER │
│   (Pre-loaded    │
│   150+ items)    │
└─────────┬────────┘
          │
          │ M:N
          │
┌─────────▼────────┐
│   DEPARTMENT     │
└──────────────────┘
```

### 2.3 Database Schema

```sql
-- Specialty Master (Pre-seeded)
CREATE TABLE specialty_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL, -- CLINICAL, SUPER_SPECIALTY, etc.
    mci_recognized BOOLEAN DEFAULT true,
    parent_specialty_id UUID REFERENCES specialty_master(id),
    description TEXT,
    common_procedures JSONB,
    common_diagnoses JSONB,
    required_equipment JSONB,
    is_active BOOLEAN DEFAULT true,
    is_system_defined BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    facility_type VARCHAR(50) NOT NULL, -- CLINICAL, SERVICE, SUPPORT
    department_type VARCHAR(50) NOT NULL, -- OPD, IPD, ICU, etc.
    location_id UUID REFERENCES location_hierarchy(id),
    location_path TEXT,
    head_of_department_id UUID REFERENCES staff(id),
    parent_department_id UUID REFERENCES departments(id),
    contact_extension VARCHAR(20),
    contact_email VARCHAR(255),
    operating_hours JSONB NOT NULL,
    is_24x7 BOOLEAN DEFAULT false,
    is_emergency BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    activation_date DATE NOT NULL,
    deactivation_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    UNIQUE(branch_id, code)
);

-- Department-Specialty Mapping (Many-to-Many)
CREATE TABLE department_specialties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    specialty_id UUID NOT NULL REFERENCES specialty_master(id),
    is_primary BOOLEAN DEFAULT false,
    services_offered JSONB, -- Array of service IDs
    staff_count INTEGER,
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(department_id, specialty_id)
);

-- Unit Types (Pre-seeded)
CREATE TABLE unit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50) NOT NULL,
    has_rooms BOOLEAN DEFAULT true,
    is_schedulable BOOLEAN DEFAULT false,
    is_bed_based BOOLEAN DEFAULT false,
    requires_pre_auth BOOLEAN DEFAULT false,
    default_operating_hours JSONB,
    standard_equipment JSONB,
    is_system_defined BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Units
CREATE TABLE units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id),
    department_id UUID NOT NULL REFERENCES departments(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    unit_type_code VARCHAR(50) NOT NULL REFERENCES unit_types(code),
    location_id UUID REFERENCES location_hierarchy(id),
    floor_number INTEGER,
    wing_zone VARCHAR(100),
    total_bed_capacity INTEGER,
    total_room_count INTEGER NOT NULL DEFAULT 0,
    can_schedule_appointments BOOLEAN DEFAULT false,
    requires_bed_assignment BOOLEAN DEFAULT false,
    has_rooms BOOLEAN DEFAULT true,
    incharge_staff_id UUID REFERENCES staff(id),
    nursing_station_location VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    commissioned_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(branch_id, code)
);

-- Rooms
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES units(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    room_number VARCHAR(50),
    room_type VARCHAR(50) NOT NULL,
    area_sq_ft DECIMAL(10,2),
    has_attached_bathroom BOOLEAN DEFAULT false,
    has_ac BOOLEAN DEFAULT false,
    has_tv BOOLEAN DEFAULT false,
    has_oxygen BOOLEAN DEFAULT false,
    has_suction BOOLEAN DEFAULT false,
    has_ventilator BOOLEAN DEFAULT false,
    has_monitoring BOOLEAN DEFAULT false,
    has_call_button BOOLEAN DEFAULT true,
    max_occupancy INTEGER NOT NULL DEFAULT 1,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    pricing_tier VARCHAR(50),
    base_charge_per_day DECIMAL(10,2),
    is_isolation BOOLEAN DEFAULT false,
    isolation_type VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    maintenance_status VARCHAR(50) DEFAULT 'OPERATIONAL',
    last_cleaned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unit_id, code)
);

-- Resources (Beds, Equipment, etc.)
CREATE TABLE resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id),
    unit_id UUID NOT NULL REFERENCES units(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    asset_tag VARCHAR(100),
    resource_type VARCHAR(50) NOT NULL,
    resource_category VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(255),
    model VARCHAR(255),
    serial_number VARCHAR(255),
    has_monitoring BOOLEAN DEFAULT false,
    has_oxygen_supply BOOLEAN DEFAULT false,
    has_suction_supply BOOLEAN DEFAULT false,
    has_ventilator_support BOOLEAN DEFAULT false,
    is_power_required BOOLEAN DEFAULT false,
    current_state VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    is_available BOOLEAN DEFAULT true,
    assigned_patient_id UUID,
    is_schedulable BOOLEAN DEFAULT false,
    slot_duration INTEGER, -- minutes
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    warranty_expiry_date DATE,
    is_active BOOLEAN DEFAULT true,
    commissioned_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(unit_id, code)
);

-- Indexes
CREATE INDEX idx_departments_branch ON departments(branch_id);
CREATE INDEX idx_departments_type ON departments(department_type);
CREATE INDEX idx_departments_location ON departments(location_id);
CREATE INDEX idx_dept_specialties_dept ON department_specialties(department_id);
CREATE INDEX idx_dept_specialties_spec ON department_specialties(specialty_id);
CREATE INDEX idx_units_department ON units(department_id);
CREATE INDEX idx_units_type ON units(unit_type_code);
CREATE INDEX idx_rooms_unit ON rooms(unit_id);
CREATE INDEX idx_rooms_available ON rooms(is_available, is_active);
CREATE INDEX idx_resources_room ON resources(room_id);
CREATE INDEX idx_resources_unit ON resources(unit_id);
CREATE INDEX idx_resources_state ON resources(current_state, is_available);
```

---

## 3. System Initialization Workflow

### 3.1 Specialty Master Data Seeding

**When:** During initial system setup or after system installation/upgrade

**Process:**

```
┌─────────────────────────────────────────────────────────────────┐
│         SPECIALTY MASTER DATA SEEDING WORKFLOW                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CHECK EXISTING DATA                                         │
│     ┌─────────────────────────────────────────────────┐         │
│     │ Query: SELECT COUNT(*) FROM specialty_master   │         │
│     │ WHERE is_system_defined = true                 │         │
│     └─────────────────┬───────────────────────────────┘         │
│                       │                                         │
│                       ▼                                         │
│     ┌─────────────────────────────────────┐                    │
│     │ If Count = 0 → Proceed to Seed     │                    │
│     │ If Count > 0 → Check Version       │                    │
│     └─────────────────┬───────────────────┘                    │
│                       │                                         │
│                       ▼                                         │
│  2. LOAD SEED DATA FILES                                        │
│     ┌─────────────────────────────────────┐                    │
│     │ /seeds/specialties/                 │                    │
│     │   ├─ clinical_specialties.json      │                    │
│     │   ├─ super_specialties.json         │                    │
│     │   ├─ allied_health.json             │                    │
│     │   └─ diagnostic_specialties.json    │                    │
│     └─────────────────┬───────────────────┘                    │
│                       │                                         │
│                       ▼                                         │
│  3. VALIDATE SEED DATA                                          │
│     ┌─────────────────────────────────────┐                    │
│     │ ✓ Check required fields             │                    │
│     │ ✓ Validate code uniqueness          │                    │
│     │ ✓ Validate parent references        │                    │
│     │ ✓ Verify MCI recognition status     │                    │
│     └─────────────────┬───────────────────┘                    │
│                       │                                         │
│                       ▼                                         │
│  4. INSERT IN TRANSACTION                                       │
│     ┌─────────────────────────────────────┐                    │
│     │ BEGIN TRANSACTION;                  │                    │
│     │                                     │                    │
│     │ INSERT Clinical Specialties (100+)  │                    │
│     │ INSERT Super-Specialties (50+)      │                    │
│     │ INSERT Allied Health (20+)          │                    │
│     │ INSERT Diagnostic (10+)             │                    │
│     │                                     │                    │
│     │ COMMIT;                             │                    │
│     └─────────────────┬───────────────────┘                    │
│                       │                                         │
│                       ▼                                         │
│  5. POST-SEED VALIDATION                                        │
│     ┌─────────────────────────────────────┐                    │
│     │ Verify Total Count = Expected       │                    │
│     │ Check Category Distribution         │                    │
│     │ Validate Parent-Child Links         │                    │
│     └─────────────────┬───────────────────┘                    │
│                       │                                         │
│                       ▼                                         │
│  6. LOG COMPLETION                                              │
│     ┌─────────────────────────────────────┐                    │
│     │ "Specialty Master seeded:           │                    │
│     │  - Clinical: 105 specialties        │                    │
│     │  - Super-specialty: 52 specialties  │                    │
│     │  - Allied Health: 18 specialties    │                    │
│     │  - Diagnostic: 12 specialties"      │                    │
│     └─────────────────────────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Seed Data Structure Example:**

```json
{
  "specialties": [
    {
      "code": "MED-001",
      "name": "General Medicine",
      "category": "CLINICAL",
      "mciRecognized": true,
      "parentSpecialty": null,
      "description": "Comprehensive medical care for adults",
      "commonProcedures": ["Physical Examination", "Basic Diagnostic Tests"],
      "commonDiagnoses": ["E11.9", "I10", "J44.9"],
      "requiredEquipment": ["Stethoscope", "BP Apparatus", "ECG Machine"]
    },
    {
      "code": "CARD-001",
      "name": "Cardiology",
      "category": "CLINICAL",
      "mciRecognized": true,
      "parentSpecialty": null,
      "description": "Heart and cardiovascular system diseases",
      "commonProcedures": ["ECG", "Echocardiography", "Stress Test", "Angiography"],
      "commonDiagnoses": ["I21.9", "I50.9", "I25.10"],
      "requiredEquipment": ["ECG Machine", "Echo Machine", "Holter Monitor"]
    },
    {
      "code": "CARD-CTS-001",
      "name": "Cardiothoracic Surgery",
      "category": "SUPER_SPECIALTY",
      "mciRecognized": true,
      "parentSpecialty": "CARD-001",
      "description": "Surgical treatment of heart and chest conditions",
      "commonProcedures": ["CABG", "Valve Replacement", "Heart Transplant"],
      "commonDiagnoses": ["I35.0", "I25.10", "I21.9"],
      "requiredEquipment": ["Heart-Lung Machine", "Cardiopulmonary Bypass"]
    }
  ]
}
```

### 3.2 Unit Type Catalog Seeding

**Process:** Similar to specialty seeding, loads 30+ pre-configured unit types

```json
{
  "unitTypes": [
    {
      "code": "OPD",
      "name": "Outpatient Department",
      "category": "OUTPATIENT",
      "hasRooms": true,
      "isSchedulable": true,
      "isBedBased": false,
      "requiresPreAuth": false,
      "defaultOperatingHours": {
        "monday": {"isOpen": true, "shifts": [{"startTime": "08:00", "endTime": "20:00"}]},
        "sunday": {"isOpen": false, "shifts": []}
      },
      "standardEquipment": ["Examination Table", "BP Apparatus", "Stethoscope"]
    },
    {
      "code": "ICU",
      "name": "Intensive Care Unit",
      "category": "CRITICAL_CARE",
      "hasRooms": true,
      "isSchedulable": false,
      "isBedBased": true,
      "requiresPreAuth": true,
      "defaultOperatingHours": {
        "is24x7": true
      },
      "standardEquipment": ["ICU Bed", "Ventilator", "Monitoring System", "Infusion Pumps"]
    }
  ]
}
```

---

## 4. Department Management Workflow

### 4.1 Department Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              DEPARTMENT CREATION WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: INITIATE CREATION                                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │ User: Infrastructure Admin / Hospital Admin       │          │
│  │ Action: Navigate to "Departments" → "Add New"     │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 2: SELECT BRANCH & LOCATION                                │
│  ┌───────────────────────────────────────────────────┐          │
│  │ If Multi-branch:                                  │          │
│  │   • Select Branch (Dropdown)                      │          │
│  │   • Required: Branch must be active               │          │
│  │                                                   │          │
│  │ Select Physical Location:                         │          │
│  │   • Load Location Hierarchy for Branch            │          │
│  │   • Select: Building → Floor → Zone/Wing          │          │
│  │   • Display: Full Path Preview                    │          │
│  │     Example: "Main Building > 2nd Floor > East"   │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 3: BASIC INFORMATION                                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Form Fields (Required):                           │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Department Code: [DEPT-XXX-###]         │       │          │
│  │ │   • Auto-generated or Manual            │       │          │
│  │ │   • Validation: Unique within branch    │       │          │
│  │ │   • Format: DEPT-{TYPE}-{SEQUENCE}      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Department Name: [_______________]      │       │          │
│  │ │   • Max 200 characters                  │       │          │
│  │ │   • Example: "Cardiology OPD"           │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Description: [_______________]          │       │          │
│  │ │   (Optional)                            │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 4: DEPARTMENT CLASSIFICATION                               │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Facility Type (Required):                         │          │
│  │   ○ CLINICAL (Patient Care)                       │          │
│  │   ○ SERVICE (Diagnostic & Support Services)       │          │
│  │   ○ SUPPORT (Administrative)                      │          │
│  │                                                   │          │
│  │ Department Type (Required):                       │          │
│  │   Dropdown (Filtered by Facility Type):          │          │
│  │   - If CLINICAL: OPD, IPD, ICU, ER, etc.         │          │
│  │   - If SERVICE: Diagnostic, Pharmacy, etc.       │          │
│  │   - If SUPPORT: Admin, HR, Maintenance           │          │
│  │                                                   │          │
│  │ [ ] Is 24x7 Department                           │          │
│  │ [ ] Is Emergency Department                       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 5: SPECIALTY ASSIGNMENT (Clinical Departments Only)        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Available Specialties (From Master):              │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Search: [_______________] 🔍            │       │          │
│  │ │                                         │       │          │
│  │ │ Categories:                             │       │          │
│  │ │ ▼ Clinical Specialties (105)            │       │          │
│  │ │   ☐ General Medicine                    │       │          │
│  │ │   ☐ General Surgery                     │       │          │
│  │ │   ☐ Cardiology                          │       │          │
│  │ │   ☐ ...                                 │       │          │
│  │ │                                         │       │          │
│  │ │ ▼ Super-Specialties (52)                │       │          │
│  │ │   ☐ Cardiothoracic Surgery              │       │          │
│  │ │   ☐ Neurosurgery                        │       │          │
│  │ │   ☐ ...                                 │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Selected Specialties:                             │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ 1. ⦿ Cardiology (Primary)   [Remove]    │       │          │
│  │ │ 2. ○ Internal Medicine      [Remove]    │       │          │
│  │ │ 3. ○ Endocrinology          [Remove]    │       │          │
│  │ │                                         │       │          │
│  │ │ [+ Add Specialty]                       │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Note: One specialty must be marked as Primary     │          │
│  │                                                   │          │
│  │ For Each Specialty (Optional):                    │          │
│  │   • Link to Service Catalog Items                │          │
│  │   • Expected Staff Count                         │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 6: OPERATING HOURS                                         │
│  ┌───────────────────────────────────────────────────┐          │
│  │ If NOT 24x7:                                      │          │
│  │                                                   │          │
│  │ Monday:    [✓] 08:00 - 20:00  [+ Add Shift]      │          │
│  │ Tuesday:   [✓] 08:00 - 20:00  [+ Add Shift]      │          │
│  │ Wednesday: [✓] 08:00 - 20:00  [+ Add Shift]      │          │
│  │ Thursday:  [✓] 08:00 - 20:00  [+ Add Shift]      │          │
│  │ Friday:    [✓] 08:00 - 20:00  [+ Add Shift]      │          │
│  │ Saturday:  [✓] 08:00 - 14:00  [+ Add Shift]      │          │
│  │ Sunday:    [ ] Closed                             │          │
│  │                                                   │          │
│  │ Break Times (Optional):                           │          │
│  │   13:00 - 14:00                                   │          │
│  │                                                   │          │
│  │ [Copy to All Days] [Load Template]               │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 7: ORGANIZATION & CONTACTS                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Head of Department (Optional):                    │          │
│  │   [Search Staff] 🔍                               │          │
│  │   • Filter: Doctors only                          │          │
│  │   • Shows: Name, Designation, Specialties         │          │
│  │                                                   │          │
│  │ Parent Department (Optional):                     │          │
│  │   [Select Department]                             │          │
│  │   • For sub-departments/sections                  │          │
│  │                                                   │          │
│  │ Contact Details:                                  │          │
│  │   Extension: [_____]                              │          │
│  │   Email: [_______________@hospital.com]           │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 8: VALIDATION & PREVIEW                                    │
│  ┌───────────────────────────────────────────────────┐          │
│  │ System Validates:                                 │          │
│  │ ✓ Code uniqueness within branch                   │          │
│  │ ✓ At least one specialty selected (if Clinical)   │          │
│  │ ✓ One primary specialty marked                    │          │
│  │ ✓ Operating hours configured                      │          │
│  │ ✓ Location selected                               │          │
│  │                                                   │          │
│  │ Preview Summary:                                  │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Department: Cardiology OPD              │       │          │
│  │ │ Code: DEPT-OPD-001                      │       │          │
│  │ │ Type: Clinical - Outpatient             │       │          │
│  │ │ Location: Main Bldg > 2nd Flr > East    │       │          │
│  │ │ Specialties:                            │       │          │
│  │ │   • Cardiology (Primary)                │       │          │
│  │ │   • Internal Medicine                   │       │          │
│  │ │ Hours: Mon-Sat 08:00-20:00              │       │          │
│  │ │ HOD: Dr. Anil Kumar (Cardiologist)      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ [Back] [Save as Draft] [Create Department]        │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 9: CREATION & POST-ACTIONS                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ System Actions:                                   │          │
│  │ 1. Create Department record                       │          │
│  │ 2. Create Department-Specialty mappings           │          │
│  │ 3. Generate Activity Log                          │          │
│  │ 4. Send Notifications (if configured)             │          │
│  │ 5. Update Location occupancy                      │          │
│  │                                                   │          │
│  │ Success Message:                                  │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ ✓ Department Created Successfully        │       │          │
│  │ │                                         │       │          │
│  │ │ "Cardiology OPD" is now active.         │       │          │
│  │ │                                         │       │          │
│  │ │ Next Steps:                             │       │          │
│  │ │ • Add Units to this department          │       │          │
│  │ │ • Assign staff members                  │       │          │
│  │ │ • Configure service catalog             │       │          │
│  │ │                                         │       │          │
│  │ │ [View Department] [Add Units] [Close]   │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Department Update/Edit Flow

**Triggers:**
- User initiates edit from Department List
- Automated system updates (e.g., HOD change)

**Process:**

```
EDIT DEPARTMENT WORKFLOW

1. LOAD CURRENT STATE
   • Fetch department record with all relationships
   • Load current specialties
   • Load assigned units
   • Load assigned staff

2. IDENTIFY CHANGE IMPACT
   • If changing specialties → Check existing patients/appointments
   • If deactivating → Validate no active patients in units
   • If changing location → Validate unit locations
   • If changing HOD → Update permissions

3. APPLY CHANGES
   • Update department record
   • Update specialty mappings
   • Log changes in audit trail
   • Trigger notifications if critical changes

4. PROPAGATE CHANGES
   • Update related units (if applicable)
   • Update staff assignments (if applicable)
   • Update service catalog mappings (if applicable)

5. VALIDATION CHECKS
   • Ensure data integrity
   • Validate business rules
   • Check for conflicts

6. CONFIRM & LOG
   • Commit transaction
   • Generate activity log
   • Send notifications
```

### 4.3 Department Deactivation Flow

```
DEPARTMENT DEACTIVATION WORKFLOW

PRE-DEACTIVATION CHECKS:
┌─────────────────────────────────────────────┐
│ System validates:                           │
│ • No active patients in department units    │
│ • No scheduled appointments                 │
│ • No pending orders/requests                │
│ • No staff actively assigned                │
│ • All units must be deactivated first       │
└─────────────────────────────────────────────┘
        │
        │ All checks pass
        ▼
DEACTIVATION PROCESS:
┌─────────────────────────────────────────────┐
│ 1. Set is_active = false                    │
│ 2. Set deactivation_date = CURRENT_DATE     │
│ 3. Unassign HOD                             │
│ 4. Cascade deactivate:                      │
│    • Department-Specialty mappings          │
│    • Service catalog links                  │
│ 5. Archive records (optional)               │
│ 6. Generate deactivation report             │
│ 7. Notify stakeholders                      │
└─────────────────────────────────────────────┘
        │
        ▼
POST-DEACTIVATION:
┌─────────────────────────────────────────────┐
│ • Update dashboards/reports                 │
│ • Hide from active department lists         │
│ • Retain in historical reports              │
│ • Allow reactivation if needed              │
└─────────────────────────────────────────────┘
```

---

## 5. Units, Rooms & Resources Workflow

### 5.1 Unit Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIT CREATION WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: PREREQUISITE CHECK                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Validate:                                         │          │
│  │ ✓ Department must exist and be active            │          │
│  │ ✓ User has permission to create units            │          │
│  │ ✓ Department has physical location assigned      │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 2: SELECT DEPARTMENT & UNIT TYPE                           │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Department: [Cardiology OPD ▼]                    │          │
│  │   Location: Main Building > 2nd Floor > East      │          │
│  │                                                   │          │
│  │ Unit Type (Required):                             │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ 🔍 Search unit types...                 │       │          │
│  │ │                                         │       │          │
│  │ │ 📋 OUTPATIENT                           │       │          │
│  │ │   ○ OPD - Outpatient Department         │       │          │
│  │ │                                         │       │          │
│  │ │ 🏥 INPATIENT                            │       │          │
│  │ │   ○ IPD_GEN - General Ward              │       │          │
│  │ │   ○ IPD_PVT - Private Ward              │       │          │
│  │ │   ○ IPD_SEMI - Semi-Private Ward        │       │          │
│  │ │                                         │       │          │
│  │ │ 🚨 CRITICAL_CARE                        │       │          │
│  │ │   ○ ICU - Intensive Care Unit           │       │          │
│  │ │   ○ ICCU - Coronary Care Unit           │       │          │
│  │ │   ○ NICU - Neonatal ICU                 │       │          │
│  │ │   ○ PICU - Pediatric ICU                │       │          │
│  │ │   ○ HDU - High Dependency Unit          │       │          │
│  │ │                                         │       │          │
│  │ │ 🔬 PROCEDURE                            │       │          │
│  │ │   ○ OT - Operation Theatre              │       │          │
│  │ │   ○ DIALYSIS - Dialysis Unit            │       │          │
│  │ │   ○ ENDO - Endoscopy Suite              │       │          │
│  │ │   ○ CATH_LAB - Cath Lab                 │       │          │
│  │ │                                         │       │          │
│  │ │ 🔬 DIAGNOSTIC                           │       │          │
│  │ │   ○ LAB - Laboratory                    │       │          │
│  │ │   ○ RAD_XRAY - X-Ray Room               │       │          │
│  │ │   ○ RAD_CT - CT Scan Room               │       │          │
│  │ │   ○ RAD_MRI - MRI Room                  │       │          │
│  │ │   ○ RAD_USG - Ultrasound Room           │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ Selected: OPD - Outpatient Department             │          │
│  │ Characteristics:                                  │          │
│  │   • Has Rooms: Yes                                │          │
│  │   • Schedulable: Yes                              │          │
│  │   • Bed-based: No                                 │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 3: BASIC INFORMATION                                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Unit Code: [UNIT-OPD-001]                         │          │
│  │   • Auto-generated: ✓                             │          │
│  │   • Format: UNIT-{TYPE}-{SEQ}                     │          │
│  │                                                   │          │
│  │ Unit Name: [Cardiology OPD Unit - A Block]        │          │
│  │   • Example: "Cardiology OPD Unit - A Block"      │          │
│  │   • Max 200 characters                            │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 4: LOCATION DETAILS                                        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Physical Location (within department):            │          │
│  │                                                   │          │
│  │ Specific Location: [Same as Department ▼]         │          │
│  │                    [Custom Location]              │          │
│  │                                                   │          │
│  │ If Custom:                                        │          │
│  │   Building: [Main Building ▼]                     │          │
│  │   Floor: [2nd Floor ▼]                            │          │
│  │   Zone/Wing: [East Wing ▼]                        │          │
│  │                                                   │          │
│  │ Additional Details (Optional):                    │          │
│  │   Floor Number: [2]                               │          │
│  │   Wing/Zone: [A Block]                            │          │
│  │   Nursing Station: [NS-2E]                        │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 5: CAPACITY CONFIGURATION                                  │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Total Room Count: [12]                            │          │
│  │   • Number of consultation/procedure rooms        │          │
│  │                                                   │          │
│  │ If Bed-based Unit:                                │          │
│  │   Total Bed Capacity: [__]                        │          │
│  │   • Sum of all beds across rooms                  │          │
│  │   • Can be auto-calculated after room setup       │          │
│  │                                                   │          │
│  │ Scheduling Configuration:                         │          │
│  │   [ ] Enable appointment scheduling               │          │
│  │       • Default slot duration: [15] minutes       │          │
│  │       • Maximum advance booking: [30] days        │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 6: STAFF ASSIGNMENT                                        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Unit In-charge (Optional):                        │          │
│  │   [Search Staff] 🔍                               │          │
│  │   • Filter by: Doctors, Nurses, Technicians       │          │
│  │   • Shows: Name, Designation, Department          │          │
│  │                                                   │          │
│  │ Nursing Station Details (Optional):               │          │
│  │   Location: [NS-2E-A]                             │          │
│  │   Contact: [Ext 2401]                             │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 7: PREVIEW & VALIDATE                                      │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Unit Summary:                                     │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Unit: Cardiology OPD Unit - A Block     │       │          │
│  │ │ Code: UNIT-OPD-001                      │       │          │
│  │ │ Type: OPD (Outpatient Department)       │       │          │
│  │ │ Department: Cardiology OPD              │       │          │
│  │ │ Location: Main > 2F > East > A Block    │       │          │
│  │ │ Total Rooms: 12                         │       │          │
│  │ │ Schedulable: Yes                        │       │          │
│  │ │ In-charge: Dr. Priya Sharma             │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ [Back] [Save as Draft] [Create Unit]              │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 8: POST-CREATION OPTIONS                                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │ ✓ Unit Created Successfully!                      │          │
│  │                                                   │          │
│  │ What would you like to do next?                   │          │
│  │                                                   │          │
│  │ [➕ Add Rooms to Unit]        ← Most Common       │          │
│  │ [📋 View Unit Details]                            │          │
│  │ [➕ Create Another Unit]                          │          │
│  │ [📊 Go to Units Dashboard]                        │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Room Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ROOM CREATION WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: CONTEXT SELECTION                                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Select Unit: [Cardiology OPD - A Block ▼]         │          │
│  │   Department: Cardiology OPD                      │          │
│  │   Type: OPD (Outpatient)                          │          │
│  │   Current Rooms: 0 / 12 planned                   │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 2: CREATION METHOD                                         │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Choose creation method:                           │          │
│  │                                                   │          │
│  │ ○ Single Room                                     │          │
│  │   Create one room at a time                       │          │
│  │                                                   │          │
│  │ ● Bulk Creation (Recommended for new units)       │          │
│  │   Create multiple similar rooms quickly           │          │
│  │                                                   │          │
│  │ ○ Import from Template                            │          │
│  │   Use pre-defined room layouts                    │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│  ┌─────────────────┴──────────────────┐                         │
│  │                                    │                         │
│  ▼ SINGLE ROOM                        ▼ BULK CREATION           │
│                                                                  │
│  SINGLE ROOM FLOW:                                               │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Room Code: [RM-OPD-A-101]                         │          │
│  │ Room Name: [Consultation Room 101]                │          │
│  │ Room Number: [101] (Display number)               │          │
│  │                                                   │          │
│  │ Room Type: [CONSULTATION ▼]                       │          │
│  │   Options:                                        │          │
│  │   • CONSULTATION (OPD rooms)                      │          │
│  │   • PATIENT_ROOM (IPD rooms)                      │          │
│  │   • PROCEDURE (Minor procedures)                  │          │
│  │   • EXAMINATION (Diagnostic)                      │          │
│  │   • ISOLATION (Special care)                      │          │
│  │   • UTILITY, STORAGE, etc.                        │          │
│  │                                                   │          │
│  │ Physical Attributes:                              │          │
│  │   Area (sq.ft): [150]                             │          │
│  │   Max Occupancy: [1] (consultation table)         │          │
│  │                                                   │          │
│  │ Amenities:                                        │          │
│  │   [✓] AC                    [✓] Oxygen Supply     │          │
│  │   [✓] Attached Bathroom     [ ] Suction           │          │
│  │   [ ] TV                    [ ] Ventilator        │          │
│  │   [✓] Monitoring Equipment  [✓] Call Button       │          │
│  │                                                   │          │
│  │ Pricing (Optional):                               │          │
│  │   Tier: [STANDARD ▼]                              │          │
│  │   Base Charge: [₹ 500] per consultation          │          │
│  │                                                   │          │
│  │ [Create Room] [Create & Add Another]              │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  BULK CREATION FLOW:                                             │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Create Multiple Similar Rooms:                    │          │
│  │                                                   │          │
│  │ Number of Rooms: [12]                             │          │
│  │                                                   │          │
│  │ Naming Convention:                                │          │
│  │   Prefix: [Consultation Room]                     │          │
│  │   Start Number: [101]                             │          │
│  │   End Number: [112]                               │          │
│  │                                                   │          │
│  │   Preview:                                        │          │
│  │   • Consultation Room 101                         │          │
│  │   • Consultation Room 102                         │          │
│  │   • ...                                           │          │
│  │   • Consultation Room 112                         │          │
│  │                                                   │          │
│  │ Common Configuration (Applied to all):            │          │
│  │   Room Type: [CONSULTATION]                       │          │
│  │   Area: [150] sq.ft each                          │          │
│  │   Max Occupancy: [1]                              │          │
│  │                                                   │          │
│  │   Amenities (Select all that apply):              │          │
│  │   [✓] AC            [✓] Oxygen     [✓] Bathroom   │          │
│  │   [ ] TV            [ ] Suction    [ ] Ventilator │          │
│  │   [✓] Monitoring    [✓] Call Button               │          │
│  │                                                   │          │
│  │   Pricing Tier: [STANDARD]                        │          │
│  │                                                   │          │
│  │ [Preview All] [Create 12 Rooms]                   │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  STEP 3: POST-CREATION                                           │
│  ┌───────────────────────────────────────────────────┐          │
│  │ ✓ 12 Rooms Created Successfully!                  │          │
│  │                                                   │          │
│  │ Unit: Cardiology OPD - A Block                    │          │
│  │ Total Rooms: 12 / 12                              │          │
│  │ Status: Ready for resource assignment             │          │
│  │                                                   │          │
│  │ Next Steps:                                       │          │
│  │ [➕ Add Resources (Beds/Equipment)]               │          │
│  │ [📋 View Room List]                               │          │
│  │ [📊 Go to Unit Dashboard]                         │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Resource (Bed/Equipment) Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 RESOURCE CREATION WORKFLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: CONTEXT SELECTION                                       │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Unit: [ICU - Block A ▼]                           │          │
│  │   Department: Critical Care                       │          │
│  │   Type: ICU                                       │          │
│  │   Rooms: 10                                       │          │
│  │                                                   │          │
│  │ Room (Optional - for fixed resources):            │          │
│  │   [ICU Room 201 ▼]                                │          │
│  │   [ ] Mobile Resource (no fixed room)             │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 2: RESOURCE TYPE SELECTION                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Resource Category:                                │          │
│  │                                                   │          │
│  │ 🛏️ BED RESOURCES                                  │          │
│  │   ○ General Bed                                   │          │
│  │   ● ICU Bed (with monitoring)                     │          │
│  │   ○ NICU Incubator                                │          │
│  │   ○ Crib                                          │          │
│  │   ○ Trolley/Stretcher                             │          │
│  │   ○ Wheelchair Position                           │          │
│  │                                                   │          │
│  │ 🔬 PROCEDURE RESOURCES                            │          │
│  │   ○ OT Table                                      │          │
│  │   ○ Dialysis Station                              │          │
│  │   ○ Chemotherapy Chair                            │          │
│  │   ○ Procedure Chair                               │          │
│  │   ○ Recovery Bay                                  │          │
│  │                                                   │          │
│  │ 📊 DIAGNOSTIC RESOURCES                           │          │
│  │   ○ X-Ray Machine Slot                            │          │
│  │   ○ CT Scanner Slot                               │          │
│  │   ○ MRI Scanner Slot                              │          │
│  │   ○ USG Machine Slot                              │          │
│  │   ○ ECG Machine Slot                              │          │
│  │                                                   │          │
│  │ 💺 CONSULTATION RESOURCES                         │          │
│  │   ○ Consultation Slot                             │          │
│  │   ○ Examination Table                             │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 3: RESOURCE DETAILS                                        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Resource Code: [BED-ICU-A-201-1]                  │          │
│  │   • Auto-generated                                │          │
│  │   • Format: {TYPE}-{UNIT}-{ROOM}-{SEQ}            │          │
│  │                                                   │          │
│  │ Resource Name: [ICU Bed 201-1]                    │          │
│  │                                                   │          │
│  │ Asset Information (Optional):                     │          │
│  │   Asset Tag: [ASSET-2024-ICU-1547]                │          │
│  │   Manufacturer: [Stryker]                         │          │
│  │   Model: [InTouch Critical Care Bed]              │          │
│  │   Serial Number: [STR-2024-14587]                 │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 4: CAPABILITIES & FEATURES                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Medical Capabilities:                             │          │
│  │   [✓] Monitoring Equipment Hookup                 │          │
│  │   [✓] Oxygen Supply Connection                    │          │
│  │   [✓] Suction Supply Connection                   │          │
│  │   [✓] Ventilator Support                          │          │
│  │   [✓] Power Supply (UPS backed)                   │          │
│  │                                                   │          │
│  │ For Schedulable Resources:                        │          │
│  │   [ ] Enable Scheduling                           │          │
│  │       Slot Duration: [__] minutes                 │          │
│  │       Booking Window: [__] days                   │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 5: MAINTENANCE SCHEDULE                                    │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Commissioned Date: [2024-01-15]                   │          │
│  │                                                   │          │
│  │ Maintenance Schedule:                             │          │
│  │   Last Maintenance: [2025-12-01]                  │          │
│  │   Next Maintenance: [2026-03-01]                  │          │
│  │   Frequency: [Quarterly ▼]                        │          │
│  │                                                   │          │
│  │ Warranty:                                         │          │
│  │   Expiry Date: [2027-01-14]                       │          │
│  └──────────────────┬────────────────────────────────┘          │
│                     │                                            │
│                     ▼                                            │
│  STEP 6: INITIAL STATE                                           │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Initial Status:                                   │          │
│  │   ● AVAILABLE (Ready for use)                     │          │
│  │   ○ MAINTENANCE (Under setup/testing)             │          │
│  │   ○ INACTIVE (Not yet commissioned)               │          │
│  │                                                   │          │
│  │ [Back] [Create Resource] [Create & Add Another]   │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Resource State Management

```
RESOURCE STATE TRANSITION WORKFLOW

States: AVAILABLE → RESERVED → OCCUPIED → CLEANING → AVAILABLE
        ↕                        ↓
    MAINTENANCE              SANITIZATION
        ↕                        ↓
    BLOCKED                  AVAILABLE
        ↕
    INACTIVE

State Change Triggers:
┌──────────────────────────────────────────────────────────┐
│ AVAILABLE → RESERVED                                      │
│   Trigger: Appointment booked / Bed reserved             │
│   By: OPD/IPD Module                                     │
│   Action: Mark resource as reserved with booking ID      │
├──────────────────────────────────────────────────────────┤
│ RESERVED → OCCUPIED                                       │
│   Trigger: Patient checked in / Procedure started        │
│   By: Registration/IPD Module                            │
│   Action: Assign patient ID, start time tracking         │
├──────────────────────────────────────────────────────────┤
│ OCCUPIED → CLEANING                                       │
│   Trigger: Patient discharged / Procedure completed      │
│   By: IPD/Procedure Module                               │
│   Action: Generate housekeeping task                     │
├──────────────────────────────────────────────────────────┤
│ CLEANING → AVAILABLE                                      │
│   Trigger: Housekeeping marked complete                  │
│   By: Housekeeping Module                                │
│   Action: Update last_cleaned_at, mark available         │
├──────────────────────────────────────────────────────────┤
│ ANY → MAINTENANCE                                         │
│   Trigger: Equipment failure / Scheduled maintenance     │
│   By: Biomedical/Admin                                   │
│   Action: Create maintenance ticket, block resource      │
├──────────────────────────────────────────────────────────┤
│ MAINTENANCE → AVAILABLE                                   │
│   Trigger: Maintenance completed                         │
│   By: Biomedical Engineer                                │
│   Action: Close maintenance ticket, restore resource     │
├──────────────────────────────────────────────────────────┤
│ ANY → BLOCKED                                             │
│   Trigger: Manual block by admin                         │
│   By: Administrator                                      │
│   Action: Provide reason, set expected duration          │
├──────────────────────────────────────────────────────────┤
│ ANY → INACTIVE                                            │
│   Trigger: Decommissioning / Permanent removal           │
│   By: Administrator                                      │
│   Action: Archive resource, update inventory             │
└──────────────────────────────────────────────────────────┘

State Change Validation:
- Cannot OCCUPY if not AVAILABLE or RESERVED
- Cannot CLEAN if not OCCUPIED
- Cannot RESERVE if BLOCKED or INACTIVE
- MAINTENANCE can be from any state (emergency)
```

---

## 6. Integration Points

### 6.1 Integration with Other Modules

```
DEPARTMENTS & SPECIALTIES INTEGRATION MAP

┌────────────────────────────────────────────────────────────┐
│                 CORE INFRASTRUCTURE MODULE                  │
│              (Departments, Units, Rooms, Resources)         │
└────┬───────────┬──────────────┬──────────────┬────────────┘
     │           │              │              │
     │           │              │              │
┌────▼────┐ ┌───▼────┐ ┌───────▼──────┐ ┌────▼──────┐
│  STAFF  │ │SERVICE │ │   LOCATION   │ │  BILLING  │
│ MODULE  │ │CATALOG │ │  HIERARCHY   │ │  MODULE   │
└────┬────┘ └───┬────┘ └───────┬──────┘ └────┬──────┘
     │          │              │              │
     │          │              │              │
┌────▼──────────▼──────────────▼──────────────▼────────┐
│            OPERATIONAL MODULES                        │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │   OPD    │  │   IPD    │  │  DIAGNOSTICS       │  │
│  └──────────┘  └──────────┘  └────────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │    OT    │  │EMERGENCY │  │   PHARMACY         │  │
│  └──────────┘  └──────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

### 6.2 Data Exchange Scenarios

#### 6.2.1 Department ↔ Staff Module

**Use Case:** Assign doctor to department specialty

```
FLOW:
1. Staff Module creates new doctor record
2. Doctor selects primary & secondary specialties (from Specialty Master)
3. Infrastructure Module:
   - Validates specialty exists
   - Checks if specialty is active
4. Staff assigned to departments with matching specialties
5. Department shows available doctors for that specialty

DATA SHARED:
- Staff ID
- Staff Name, Designation
- Primary Specialty ID
- Secondary Specialty IDs
- Department Assignments
```

#### 6.2.2 Department ↔ Service Catalog

**Use Case:** Link services to department specialties

```
FLOW:
1. Service Catalog item created (e.g., "Echocardiography")
2. Service tagged with specialty (e.g., "Cardiology")
3. Infrastructure Module:
   - Finds all departments offering Cardiology
   - Auto-suggests linking service to those departments
4. When department offers a specialty:
   - All services tagged with that specialty become available
   - Service catalog filters show department-specific services

DATA SHARED:
- Department ID
- Specialty IDs
- Service IDs
- Service Categories
```

#### 6.2.3 Unit ↔ OPD Scheduling

**Use Case:** Schedule appointment in OPD unit

```
FLOW:
1. Patient requests appointment in "Cardiology OPD"
2. OPD Module queries Infrastructure Module:
   - Get active OPD units for Cardiology department
   - Get rooms in those units
   - Get consultation slots (resources) in those rooms
   - Check availability status
3. Display available slots to patient
4. On booking:
   - Resource state changes: AVAILABLE → RESERVED
   - Room occupancy incremented
5. On check-in:
   - Resource state changes: RESERVED → OCCUPIED
   - Doctor gets notification

DATA SHARED:
- Unit ID, Name
- Room IDs, Availability
- Resource IDs, States
- Scheduling parameters (slot duration)
```

#### 6.2.4 Room/Bed ↔ IPD Module

**Use Case:** Admit patient to IPD bed

```
FLOW:
1. Doctor orders IPD admission
2. IPD Module queries Infrastructure Module:
   - Get available IPD units for required specialty
   - Filter by bed type (General/Private/ICU)
   - Filter by gender-appropriate wards
   - Get available beds in those units
3. Display available beds with:
   - Room details (amenities, pricing tier)
   - Bed capabilities (monitoring, oxygen, etc.)
4. On admission:
   - Resource state: AVAILABLE → OCCUPIED
   - Assign patient ID to resource
   - Room current_occupancy++
   - Unit bed occupancy updated
5. On discharge:
   - Resource state: OCCUPIED → CLEANING
   - Housekeeping task generated
   - After cleaning: CLEANING → AVAILABLE

DATA SHARED:
- Unit IDs, Capacity
- Room IDs, Occupancy, Amenities
- Resource (Bed) IDs, States, Capabilities
- Patient Assignment
```

#### 6.2.5 Unit ↔ Queue Management

**Use Case:** Generate token for OPD unit

```
FLOW:
1. Patient arrives at reception
2. Queue Module queries Infrastructure Module:
   - Get OPD units in department
   - Check if unit has queue configuration
   - Get counter assignments
3. Generate token for unit
4. Display on queue screens
5. When doctor ready:
   - Token called
   - Resource (consultation slot) occupied

DATA SHARED:
- Unit ID, Type
- Queue Configuration
- Counter Assignments
- Resource Availability
```

---

## 7. Business Rules & Validations

### 7.1 Department Business Rules

```
DEPARTMENT VALIDATION RULES

1. UNIQUENESS RULES
   ✓ Department code must be unique within branch
   ✓ Department name should be unique within branch (warning, not blocking)
   ✓ Location cannot be assigned to multiple departments (optional rule)

2. SPECIALTY ASSIGNMENT RULES
   ✓ Clinical departments must have at least one specialty
   ✓ Non-clinical departments (Service/Support) may have no specialties
   ✓ At least one specialty must be marked as "Primary"
   ✓ Only one specialty can be marked as "Primary"
   ✓ Specialty must be active to be assigned

3. LOCATION RULES
   ✓ Department must have a physical location assigned
   ✓ Location must be active
   ✓ Location must exist in branch's location hierarchy
   ✓ Location level should be AREA or deeper (not CAMPUS/BUILDING)

4. OPERATING HOURS RULES
   ✓ If not 24x7, at least one day must have operating hours
   ✓ Start time must be before end time
   ✓ Break time must be within operating hours
   ✓ Multiple shifts on same day cannot overlap
   ✓ Emergency departments should be 24x7 (warning)

5. STAFF ASSIGNMENT RULES
   ✓ HOD must be a doctor (not nurse/technician)
   ✓ HOD must have a specialty matching one of department's specialties
   ✓ HOD must be active staff member
   ✓ HOD can be assigned to only one department as HOD

6. HIERARCHY RULES
   ✓ Parent department must exist and be active
   ✓ Parent department must be in same branch
   ✓ No circular parent-child relationships
   ✓ Maximum 3 levels of nesting

7. DEACTIVATION RULES
   ✓ Cannot deactivate if has active units
   ✓ Cannot deactivate if has active patients (check with IPD/OPD)
   ✓ Cannot deactivate if has scheduled appointments
   ✓ Must provide deactivation reason
   ✓ HOD unassignment on deactivation
```

### 7.2 Unit Business Rules

```
UNIT VALIDATION RULES

1. UNIQUENESS RULES
   ✓ Unit code must be unique within branch
   ✓ Unit name should be unique within department

2. DEPARTMENT ASSOCIATION RULES
   ✓ Unit must belong to an active department
   ✓ Unit type should match department type (e.g., OPD unit in OPD dept)
   ✓ Unit cannot be created without department

3. UNIT TYPE RULES
   ✓ Unit type must exist in Unit Type Catalog
   ✓ Unit inherits characteristics from unit type:
     - hasRooms flag
     - isSchedulable flag
     - isBedBased flag
   ✓ Cannot change unit type after creation (data integrity)

4. CAPACITY RULES
   ✓ Total room count must be >= 0
   ✓ Total bed capacity (if bed-based) must be >= sum of room capacities
   ✓ Cannot reduce room count below current room count
   ✓ Cannot reduce bed capacity below occupied beds

5. LOCATION RULES
   ✓ Unit location must be within department's location or deeper
   ✓ Location must be active
   ✓ Floor number should match location hierarchy floor

6. SCHEDULING RULES (if schedulable)
   ✓ Slot duration must be between 5-120 minutes
   ✓ Advance booking window must be between 1-365 days
   ✓ Default operating hours inherited from department

7. DEACTIVATION RULES
   ✓ Cannot deactivate if has active rooms with patients
   ✓ Cannot deactivate if has scheduled procedures
   ✓ Must deactivate all rooms first
   ✓ Must provide deactivation reason
```

### 7.3 Room Business Rules

```
ROOM VALIDATION RULES

1. UNIQUENESS RULES
   ✓ Room code must be unique within unit
   ✓ Room number should be unique within unit

2. UNIT ASSOCIATION RULES
   ✓ Room must belong to an active unit
   ✓ Unit must have hasRooms = true
   ✓ Room cannot be created in non-room unit types

3. ROOM TYPE RULES
   ✓ Room type must be appropriate for unit type:
     - OPD units: CONSULTATION, EXAMINATION
     - IPD units: PATIENT_ROOM
     - ICU units: PATIENT_ROOM, ISOLATION
     - OT units: PROCEDURE
   ✓ ISOLATION rooms must have isolation type specified

4. CAPACITY RULES
   ✓ Max occupancy must be >= 1
   ✓ Current occupancy cannot exceed max occupancy
   ✓ Current occupancy must be >= count of occupied resources
   ✓ Area (sq.ft) should be proportional to max occupancy (warning)

5. AMENITY RULES
   ✓ ICU/Critical care rooms should have monitoring (warning)
   ✓ ISOLATION rooms should have attached bathroom (warning)
   ✓ NEGATIVE_PRESSURE rooms should have suction (warning)

6. PRICING RULES
   ✓ Pricing tier required for patient rooms
   ✓ Base charge should be > 0 if pricing tier is set
   ✓ VIP/SUITE tier should have AC, TV, attached bathroom (warning)

7. MAINTENANCE STATUS RULES
   ✓ Room in UNDER_MAINTENANCE cannot be occupied
   ✓ Room in CLEANING_IN_PROGRESS cannot be newly occupied
   ✓ Room in OUT_OF_SERVICE is not available
   ✓ Room in BLOCKED requires blocking reason

8. DEACTIVATION RULES
   ✓ Cannot deactivate if current occupancy > 0
   ✓ Cannot deactivate if has reserved appointments
   ✓ Must deactivate all resources first
```

### 7.4 Resource Business Rules

```
RESOURCE VALIDATION RULES

1. UNIQUENESS RULES
   ✓ Resource code must be unique within unit
   ✓ Asset tag (if provided) must be unique across branch

2. ROOM/UNIT ASSOCIATION RULES
   ✓ Resource must belong to an active unit
   ✓ If room assigned, room must belong to same unit
   ✓ If room assigned, room must be active
   ✓ Mobile resources can have null room_id

3. RESOURCE TYPE RULES
   ✓ Resource type must match unit type:
     - ICU units: ICU_BED, monitoring equipment
     - OT units: OT_TABLE
     - Dialysis units: DIALYSIS_STATION
     - Radiology: Diagnostic equipment slots
   ✓ Resource category auto-derived from resource type

4. CAPABILITY RULES
   ✓ ICU_BED should have monitoring, oxygen, suction (warning)
   ✓ NICU_INCUBATOR should have monitoring (warning)
   ✓ OT_TABLE should have power required (warning)
   ✓ Diagnostic equipment should be schedulable

5. OCCUPANCY RULES
   ✓ Resource can only be OCCUPIED if previously AVAILABLE or RESERVED
   ✓ Cannot RESERVE if state is BLOCKED, MAINTENANCE, or INACTIVE
   ✓ Cannot assign patient if state is not OCCUPIED
   ✓ Assigned patient ID must be valid active patient

6. SCHEDULING RULES (if schedulable)
   ✓ Slot duration must be > 0
   ✓ Slot duration should match service duration (e.g., MRI = 30-45 min)
   ✓ Cannot schedule if state is not AVAILABLE

7. MAINTENANCE RULES
   ✓ Next maintenance date should be > Last maintenance date
   ✓ Cannot operate if next maintenance date is past due (warning)
   ✓ Warranty expiry alerts

8. STATE TRANSITION RULES
   ✓ State changes must follow valid transitions
   ✓ Cannot skip states (e.g., AVAILABLE → CLEANING invalid)
   ✓ State change requires reason if going to BLOCKED
   ✓ State change requires maintenance ticket if going to MAINTENANCE

9. DEACTIVATION RULES
   ✓ Cannot deactivate if state is OCCUPIED
   ✓ Cannot deactivate if state is RESERVED
   ✓ Can deactivate if in MAINTENANCE (after maintenance complete)
```

### 7.5 Cross-Entity Validations

```
CROSS-ENTITY VALIDATION RULES

1. DEPARTMENT-UNIT-ROOM-RESOURCE CASCADE
   ✓ Cannot delete department if has active units
   ✓ Cannot delete unit if has active rooms
   ✓ Cannot delete room if has active resources
   ✓ Deactivation must cascade in order: Resource → Room → Unit → Department

2. CAPACITY CONSISTENCY
   ✓ Unit.total_bed_capacity = SUM(Room.max_occupancy) for all rooms in unit
   ✓ Unit.total_room_count = COUNT(active rooms in unit)
   ✓ Room.current_occupancy = COUNT(resources in OCCUPIED state)
   ✓ Department summary stats must match sum of unit stats

3. LOCATION HIERARCHY CONSISTENCY
   ✓ Unit location must be at same level or deeper than department location
   ✓ All rooms in unit should be at same location or nearby
   ✓ Cannot delete location if assigned to active department/unit

4. SPECIALTY-SERVICE-DEPARTMENT CONSISTENCY
   ✓ Services tagged with specialty should be available in departments offering that specialty
   ✓ Doctors with specialty can be assigned to departments offering that specialty
   ✓ Appointments for specialty-specific services should route to appropriate departments

5. STAFF-DEPARTMENT CONSISTENCY
   ✓ Department HOD should have specialty matching department's primary specialty
   ✓ Unit in-charge should be assigned to unit's department
   ✓ Staff on-duty in unit should have access permissions for that unit

6. OPERATIONAL CONSISTENCY
   ✓ Room maintenance status should update resource states
   ✓ Unit deactivation should block new appointments/admissions
   ✓ Department operating hours should cascade to unit scheduling
```

---

## 8. User Roles & Permissions

### 8.1 Role Definitions

```
USER ROLE HIERARCHY

┌─────────────────────────────────────────────┐
│ SYSTEM ADMINISTRATOR                        │
│ • Full access to all infrastructure modules │
│ • Manage specialties, departments, units    │
│ • Override all validations                  │
│ • Access all branches                       │
└───────────────┬─────────────────────────────┘
                │
        ┌───────┴──────┐
        │              │
┌───────▼──────┐  ┌────▼──────────────────────┐
│ HOSPITAL     │  │ INFRASTRUCTURE ADMIN      │
│ ADMINISTRATOR│  │ • Manage departments,     │
│ • Manage own │  │   units, rooms            │
│   branch     │  │ • View reports            │
│ • All infra  │  │ • Bulk operations         │
│   operations │  │ • Single branch           │
└──────┬───────┘  └────┬──────────────────────┘
       │               │
       └───────┬───────┘
               │
       ┌───────┴──────────────────┐
       │                          │
┌──────▼─────────┐  ┌─────────────▼──────────┐
│ DEPARTMENT     │  │ OPERATIONS MANAGER     │
│ HEAD (HOD)     │  │ • View infrastructure  │
│ • Manage own   │  │ • Generate reports     │
│   dept units   │  │ • Manage resources     │
│ • View staff   │  │ • Update statuses      │
│ • Update hours │  │                        │
└────────────────┘  └────────────────────────┘
```

### 8.2 Permission Matrix

```
PERMISSION MATRIX

┌──────────────────────┬─────────┬───────────┬────────┬──────┐
│ Action               │ SysAdmin│ HospAdmin │InfraAdm│ HOD  │
├──────────────────────┼─────────┼───────────┼────────┼──────┤
│ SPECIALTY MASTER     │         │           │        │      │
│ • View               │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Create Custom      │    ✓    │     ✗     │   ✗    │  ✗   │
│ • Edit System        │    ✓    │     ✗     │   ✗    │  ✗   │
│ • Deactivate         │    ✓    │     ✗     │   ✗    │  ✗   │
├──────────────────────┼─────────┼───────────┼────────┼──────┤
│ DEPARTMENTS          │         │           │        │      │
│ • View All           │    ✓    │     ✓     │   ✓    │  ✗   │
│ • View Own           │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Create             │    ✓    │     ✓     │   ✓    │  ✗   │
│ • Edit All           │    ✓    │     ✓     │   ✗    │  ✗   │
│ • Edit Own           │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Assign Specialties │    ✓    │     ✓     │   ✓    │  ✗   │
│ • Assign HOD         │    ✓    │     ✓     │   ✓    │  ✗   │
│ • Deactivate         │    ✓    │     ✓     │   ✓**  │  ✗   │
├──────────────────────┼─────────┼───────────┼────────┼──────┤
│ UNITS                │         │           │        │      │
│ • View All           │    ✓    │     ✓     │   ✓    │  ✗   │
│ • View Dept Units    │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Create             │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Edit All           │    ✓    │     ✓     │   ✗    │  ✗   │
│ • Edit Dept Units    │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Assign In-charge   │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Deactivate         │    ✓    │     ✓     │   ✓**  │  ✗   │
├──────────────────────┼─────────┼───────────┼────────┼──────┤
│ ROOMS                │         │           │        │      │
│ • View All           │    ✓    │     ✓     │   ✓    │  ✗   │
│ • View Unit Rooms    │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Create             │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Edit               │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Update Status      │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Bulk Create        │    ✓    │     ✓     │   ✓    │  ✗   │
│ • Deactivate         │    ✓    │     ✓     │   ✓**  │  ✗   │
├──────────────────────┼─────────┼───────────┼────────┼──────┤
│ RESOURCES            │         │           │        │      │
│ • View All           │    ✓    │     ✓     │   ✓    │  ✗   │
│ • View Unit Resource │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Create             │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Edit               │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Change State       │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Block/Unblock      │    ✓    │     ✓     │   ✓    │  ✓*  │
│ • Maintenance        │    ✓    │     ✓     │   ✓    │  ✗   │
│ • Deactivate         │    ✓    │     ✓     │   ✓**  │  ✗   │
├──────────────────────┼─────────┼───────────┼────────┼──────┤
│ REPORTS              │         │           │        │      │
│ • View Dashboard     │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Occupancy Reports  │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Utilization Report │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Export Data        │    ✓    │     ✓     │   ✓    │  ✓   │
│ • Audit Logs         │    ✓    │     ✓     │   ✗    │  ✗   │
└──────────────────────┴─────────┴───────────┴────────┴──────┘

Legend:
✓   = Full permission
✓*  = Limited to own department only
✓** = Requires approval/validation
✗   = No permission
```

### 8.3 Data Visibility Rules

```
DATA VISIBILITY BY ROLE

SYSTEM ADMINISTRATOR:
- View: All branches, all departments, all units
- Filter: Can switch between branches
- Scope: Enterprise-wide

HOSPITAL ADMINISTRATOR:
- View: Single branch only
- Filter: All departments in their branch
- Scope: Branch-level
- Cannot: Access other branches

INFRASTRUCTURE ADMIN:
- View: Single branch only (if multi-branch)
- Filter: All departments
- Scope: Branch infrastructure
- Cannot: Access operational data (patients, billing)

DEPARTMENT HEAD (HOD):
- View: Only their department
- Filter: Units in their department
- Scope: Department-level
- Cannot: View other departments
- Cannot: Edit other departments' configurations

OPERATIONS MANAGER:
- View: All departments (read-only)
- Filter: Can filter by department, unit
- Scope: Cross-department read access
- Cannot: Edit configurations
- Can: Generate reports, view status

UNIT IN-CHARGE:
- View: Only their assigned unit
- Filter: Rooms and resources in their unit
- Scope: Unit-level
- Cannot: View other units
- Can: Update resource status, room availability
```

---

## 9. API Specifications

### 9.1 Specialty Master APIs

```typescript
// Get all specialties
GET /api/v1/specialties
Query Params:
  - category: string (CLINICAL, SUPER_SPECIALTY, etc.)
  - mciRecognized: boolean
  - isActive: boolean
  - search: string (search by name/code)
Response: Specialty[]

// Get specialty by ID
GET /api/v1/specialties/:id
Response: Specialty

// Get specialty hierarchy (parent-child)
GET /api/v1/specialties/:id/children
Response: Specialty[]

// Get procedures for specialty
GET /api/v1/specialties/:id/procedures
Response: string[]

// Get common diagnoses for specialty
GET /api/v1/specialties/:id/diagnoses
Response: string[]

// Create custom specialty (SysAdmin only)
POST /api/v1/specialties
Body: {
  code: string;
  name: string;
  category: SpecialtyCategory;
  parentSpecialty?: string;
  description: string;
}
Response: Specialty
```

### 9.2 Department APIs

```typescript
// Get all departments
GET /api/v1/departments
Query Params:
  - branchId: string
  - facilityType: string
  - departmentType: string
  - specialtyId: string (filter by specialty)
  - isActive: boolean
  - search: string
Response: {
  data: Department[];
  total: number;
  page: number;
  pageSize: number;
}

// Get department by ID
GET /api/v1/departments/:id
Response: Department (with specialties, units, staff)

// Get department specialties
GET /api/v1/departments/:id/specialties
Response: SpecialtyAssignment[]

// Get department units
GET /api/v1/departments/:id/units
Response: Unit[]

// Get department staff
GET /api/v1/departments/:id/staff
Response: Staff[]

// Create department
POST /api/v1/departments
Body: {
  branchId: string;
  code?: string; // Auto-generated if not provided
  name: string;
  description?: string;
  facilityType: FacilityType;
  departmentType: DepartmentType;
  locationId: string;
  specialties: {
    specialtyId: string;
    isPrimary: boolean;
  }[];
  headOfDepartmentId?: string;
  parentDepartmentId?: string;
  contactExtension?: string;
  contactEmail?: string;
  operatingHours: OperatingHours;
  is24x7: boolean;
  isEmergency: boolean;
}
Response: Department

// Update department
PATCH /api/v1/departments/:id
Body: Partial<Department>
Response: Department

// Add specialty to department
POST /api/v1/departments/:id/specialties
Body: {
  specialtyId: string;
  isPrimary: boolean;
  servicesOffered?: string[];
}
Response: SpecialtyAssignment

// Remove specialty from department
DELETE /api/v1/departments/:id/specialties/:specialtyId
Response: { success: boolean }

// Update department operating hours
PATCH /api/v1/departments/:id/operating-hours
Body: OperatingHours
Response: Department

// Deactivate department
POST /api/v1/departments/:id/deactivate
Body: {
  reason: string;
  deactivationDate: Date;
}
Response: Department
```

### 9.3 Unit APIs

```typescript
// Get all units
GET /api/v1/units
Query Params:
  - branchId: string
  - departmentId: string
  - unitType: string
  - isActive: boolean
  - hasAvailableBeds: boolean (for bed-based units)
  - search: string
Response: {
  data: Unit[];
  total: number;
}

// Get unit by ID
GET /api/v1/units/:id
Response: Unit (with rooms, resources)

// Get unit capacity
GET /api/v1/units/:id/capacity
Response: {
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number; // percentage
}

// Get unit rooms
GET /api/v1/units/:id/rooms
Query Params:
  - isAvailable: boolean
  - roomType: string
Response: Room[]

// Get unit resources
GET /api/v1/units/:id/resources
Query Params:
  - resourceType: string
  - isAvailable: boolean
  - currentState: string
Response: Resource[]

// Create unit
POST /api/v1/units
Body: {
  branchId: string;
  departmentId: string;
  code?: string; // Auto-generated if not provided
  name: string;
  unitType: string; // From UnitType catalog
  locationId: string;
  floorNumber?: number;
  wingZone?: string;
  totalBedCapacity?: number;
  totalRoomCount: number;
  inchargeStaffId?: string;
  nursingStationLocation?: string;
}
Response: Unit

// Update unit
PATCH /api/v1/units/:id
Body: Partial<Unit>
Response: Unit

// Bulk create units
POST /api/v1/units/bulk
Body: {
  departmentId: string;
  units: UnitInput[];
}
Response: Unit[]

// Deactivate unit
POST /api/v1/units/:id/deactivate
Body: { reason: string }
Response: Unit
```

### 9.4 Room APIs

```typescript
// Get all rooms
GET /api/v1/rooms
Query Params:
  - unitId: string
  - roomType: string
  - isAvailable: boolean
  - pricingTier: string
  - minArea: number
  - maxArea: number
Response: Room[]

// Get room by ID
GET /api/v1/rooms/:id
Response: Room (with resources)

// Get room resources
GET /api/v1/rooms/:id/resources
Response: Resource[]

// Get room availability
GET /api/v1/rooms/:id/availability
Response: {
  isAvailable: boolean;
  currentOccupancy: number;
  maxOccupancy: number;
  availableResources: number;
  maintenanceStatus: string;
  lastCleaned: Date;
}

// Create room
POST /api/v1/rooms
Body: {
  unitId: string;
  code?: string; // Auto-generated if not provided
  name: string;
  roomNumber: string;
  roomType: RoomType;
  areaSqFt?: number;
  hasAttachedBathroom: boolean;
  hasAC: boolean;
  hasTV: boolean;
  hasOxygen: boolean;
  hasSuction: boolean;
  hasVentilator: boolean;
  hasMonitoring: boolean;
  hasCallButton: boolean;
  maxOccupancy: number;
  pricingTier?: PricingTier;
  baseChargePerDay?: number;
  isIsolation: boolean;
  isolationType?: IsolationType;
}
Response: Room

// Bulk create rooms
POST /api/v1/rooms/bulk
Body: {
  unitId: string;
  namePrefix: string;
  startNumber: number;
  endNumber: number;
  commonConfig: {
    roomType: RoomType;
    areaSqFt: number;
    // ... other common attributes
  };
}
Response: Room[]

// Update room
PATCH /api/v1/rooms/:id
Body: Partial<Room>
Response: Room

// Update room status
PATCH /api/v1/rooms/:id/status
Body: {
  maintenanceStatus: MaintenanceStatus;
  reason?: string;
}
Response: Room

// Mark room cleaned
POST /api/v1/rooms/:id/mark-cleaned
Body: {
  cleanedBy: string;
  notes?: string;
}
Response: Room
```

### 9.5 Resource APIs

```typescript
// Get all resources
GET /api/v1/resources
Query Params:
  - unitId: string
  - roomId: string
  - resourceType: string
  - currentState: string
  - isAvailable: boolean
Response: Resource[]

// Get resource by ID
GET /api/v1/resources/:id
Response: Resource

// Get resource availability
GET /api/v1/resources/:id/availability
Response: {
  isAvailable: boolean;
  currentState: ResourceState;
  assignedPatient?: {
    id: string;
    name: string;
    admissionDate: Date;
  };
  nextAvailableAt?: Date;
  scheduledBookings?: {
    bookingId: string;
    startTime: Date;
    endTime: Date;
  }[];
}

// Create resource
POST /api/v1/resources
Body: {
  roomId?: string; // Optional for mobile resources
  unitId: string;
  code?: string; // Auto-generated if not provided
  name: string;
  assetTag?: string;
  resourceType: ResourceType;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  hasMonitoring: boolean;
  hasOxygenSupply: boolean;
  hasSuctionSupply: boolean;
  hasVentilatorSupport: boolean;
  isPowerRequired: boolean;
  isSchedulable: boolean;
  slotDuration?: number; // For schedulable resources
  commissionedDate: Date;
  nextMaintenanceDate?: Date;
  warrantyExpiryDate?: Date;
}
Response: Resource

// Update resource
PATCH /api/v1/resources/:id
Body: Partial<Resource>
Response: Resource

// Change resource state
POST /api/v1/resources/:id/change-state
Body: {
  newState: ResourceState;
  reason?: string;
  notes?: string;
}
Response: Resource

// Assign patient to resource
POST /api/v1/resources/:id/assign-patient
Body: {
  patientId: string;
  admissionId?: string;
  procedureId?: string;
}
Response: Resource

// Release resource (unassign patient)
POST /api/v1/resources/:id/release
Body: {
  dischargeReason?: string;
  notes?: string;
}
Response: Resource

// Block resource
POST /api/v1/resources/:id/block
Body: {
  reason: string;
  expectedDuration?: number; // hours
  notes?: string;
}
Response: Resource

// Unblock resource
POST /api/v1/resources/:id/unblock
Body: {
  notes?: string;
}
Response: Resource

// Schedule maintenance
POST /api/v1/resources/:id/schedule-maintenance
Body: {
  maintenanceType: string;
  scheduledDate: Date;
  expectedDuration: number; // hours
  notes?: string;
}
Response: Resource
```

### 9.6 Bulk Operations APIs

```typescript
// Bulk import departments
POST /api/v1/departments/import
Content-Type: multipart/form-data
Body: {
  file: File; // CSV/Excel file
  branchId: string;
}
Response: {
  successful: number;
  failed: number;
  errors: {
    row: number;
    error: string;
  }[];
}

// Bulk import rooms
POST /api/v1/rooms/import
Content-Type: multipart/form-data
Body: {
  file: File; // CSV/Excel file
  unitId: string;
}
Response: {
  successful: number;
  failed: number;
  errors: {
    row: number;
    error: string;
  }[];
}

// Clone department to another branch
POST /api/v1/departments/:id/clone
Body: {
  targetBranchId: string;
  includeUnits: boolean;
  includeRooms: boolean;
  includeResources: boolean;
}
Response: Department

// Template export
GET /api/v1/templates/departments/export
Response: CSV file template

GET /api/v1/templates/rooms/export
Response: CSV file template
```

### 9.7 Reporting APIs

```typescript
// Department summary
GET /api/v1/reports/departments/summary
Query Params:
  - branchId: string
  - startDate: Date
  - endDate: Date
Response: {
  totalDepartments: number;
  activeDepartments: number;
  departmentsByType: {
    type: string;
    count: number;
  }[];
  departmentsByFacility: {
    facilityType: string;
    count: number;
  }[];
}

// Unit occupancy report
GET /api/v1/reports/units/occupancy
Query Params:
  - branchId: string
  - departmentId: string
  - date: Date
Response: {
  units: {
    unitId: string;
    unitName: string;
    totalBeds: number;
    occupiedBeds: number;
    occupancyRate: number;
    availableBeds: number;
  }[];
}

// Room utilization report
GET /api/v1/reports/rooms/utilization
Query Params:
  - unitId: string
  - startDate: Date
  - endDate: Date
Response: {
  rooms: {
    roomId: string;
    roomName: string;
    totalHours: number;
    occupiedHours: number;
    utilizationRate: number;
  }[];
}

// Resource availability report
GET /api/v1/reports/resources/availability
Query Params:
  - unitId: string
  - resourceType: string
  - date: Date
Response: {
  resources: {
    resourceId: string;
    resourceName: string;
    currentState: string;
    isAvailable: boolean;
    lastUpdated: Date;
  }[];
}
```

---

## 10. UI/UX Flow

### 10.1 Navigation Structure

```
INFRASTRUCTURE SETUP NAVIGATION

┌─────────────────────────────────────────────────────┐
│ Infrastructure Setup                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📋 Departments & Specialties                        │
│    ├─ 🏥 Departments                                │
│    │   ├─ View All Departments                      │
│    │   ├─ Add Department                            │
│    │   ├─ Department Details (Edit, Deactivate)     │
│    │   └─ Department Dashboard                      │
│    └─ 🎓 Specialties                                │
│        ├─ View All Specialties                      │
│        └─ Specialty Details                         │
│                                                     │
│ 🏢 Units & Rooms                                    │
│    ├─ 🏥 Units                                      │
│    │   ├─ View All Units                            │
│    │   ├─ Add Unit                                  │
│    │   ├─ Unit Details (Edit)                       │
│    │   └─ Unit Dashboard                            │
│    ├─ 🚪 Rooms                                      │
│    │   ├─ View All Rooms                            │
│    │   ├─ Add Room                                  │
│    │   ├─ Bulk Add Rooms                            │
│    │   └─ Room Details (Edit)                       │
│    └─ 🛏️ Resources                                  │
│        ├─ View All Resources                        │
│        ├─ Add Resource                              │
│        ├─ Resource Details (Edit)                   │
│        └─ Resource Status Board                     │
│                                                     │
│ 📊 Reports & Analytics                              │
│    ├─ Occupancy Reports                             │
│    ├─ Utilization Reports                           │
│    └─ Capacity Planning                             │
│                                                     │
│ ⚙️ Configuration                                    │
│    ├─ Unit Types                                    │
│    ├─ Room Types                                    │
│    └─ Resource Types                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 10.2 Department List Screen

```
┌──────────────────────────────────────────────────────────────┐
│ Departments                                   [+ Add Department] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Filters:                                                     │
│ Branch: [All ▼]  Type: [All ▼]  Status: [Active ▼]         │
│ Search: [_______________________] 🔍                         │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ Dept.      │ Type    │ Specialties │ Units │ Status   │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ Cardiology │ OPD     │ Cardiology  │   3   │ ✓ Active │  │
│ │ OPD        │         │ Int. Med.   │       │          │  │
│ │            │         │             │       │  [Edit]  │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ ICU        │ Critical│ Critical    │   2   │ ✓ Active │  │
│ │            │ Care    │ Care Med.   │       │          │  │
│ │            │         │             │       │  [Edit]  │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ Radiology  │ Diagno- │ Radiology   │   4   │ ✓ Active │  │
│ │            │ stic    │             │       │          │  │
│ │            │         │             │       │  [Edit]  │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ ...        │ ...     │ ...         │  ...  │   ...    │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ Showing 1-10 of 24 departments      [Prev] [1] [2] [3] [Next]│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.3 Department Details/Edit Screen

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back to Departments        Cardiology OPD      [Edit] [⋮]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ Basic Information ─────────────────────────────────────┐  │
│ │ Code: DEPT-OPD-001                                      │  │
│ │ Name: Cardiology OPD                                    │  │
│ │ Type: Clinical - Outpatient Department                  │  │
│ │ Location: Main Building > 2nd Floor > East Wing         │  │
│ │ Status: ✓ Active (since Jan 15, 2024)                  │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Specialties ────────────────────────────────────────────┐  │
│ │ ⦿ Cardiology (Primary)                                  │  │
│ │ ○ Internal Medicine                                     │  │
│ │ ○ Endocrinology                                         │  │
│ │                                            [Manage]      │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Organization ───────────────────────────────────────────┐  │
│ │ Head of Department: Dr. Anil Kumar                      │  │
│ │                     Consultant Cardiologist             │  │
│ │ Contact: Ext 2401 | cardiology@hospital.com            │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Operating Hours ────────────────────────────────────────┐  │
│ │ Monday - Friday:    08:00 AM - 08:00 PM                 │  │
│ │ Saturday:           08:00 AM - 02:00 PM                 │  │
│ │ Sunday:             Closed                              │  │
│ │ Break:              01:00 PM - 02:00 PM                 │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Units (3) ──────────────────────────────────────────────┐  │
│ │ ┌─────────────────────────────────────────────────────┐ │  │
│ │ │ Cardiology OPD - A Block                            │ │  │
│ │ │ Type: OPD  |  Rooms: 12  |  Status: Active          │ │  │
│ │ │                                           [View →]   │ │  │
│ │ ├─────────────────────────────────────────────────────┤ │  │
│ │ │ Cardiology OPD - B Block                            │ │  │
│ │ │ Type: OPD  |  Rooms: 8   |  Status: Active          │ │  │
│ │ │                                           [View →]   │ │  │
│ │ ├─────────────────────────────────────────────────────┤ │  │
│ │ │ Cardiac Procedure Room                              │ │  │
│ │ │ Type: PROCEDURE  |  Rooms: 2  |  Status: Active     │ │  │
│ │ │                                           [View →]   │ │  │
│ │ └─────────────────────────────────────────────────────┘ │  │
│ │                                         [+ Add Unit]     │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Quick Stats ────────────────────────────────────────────┐  │
│ │ Total Staff: 24      Total Patients Today: 156          │  │
│ │ Active Appointments: 89    Total Rooms: 22              │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.4 Unit Dashboard Screen

```
┌──────────────────────────────────────────────────────────────┐
│ ← Cardiology OPD        Unit: Cardiology OPD - A Block       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ ┌─ Unit Overview ──────────────────────────────────────────┐  │
│ │ Code: UNIT-OPD-001                                       │  │
│ │ Type: OPD (Outpatient Department)                        │  │
│ │ Location: Main Building > 2nd Floor > East Wing > A Block│  │
│ │ In-charge: Dr. Priya Sharma                             │  │
│ │ Status: ✓ Active                                        │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Capacity Summary ───────────────────────────────────────┐  │
│ │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│ │ │   ROOMS     │  │ CONSULTATIONS│  │   STAFF     │       │  │
│ │ │             │  │              │  │             │       │  │
│ │ │  12 / 12    │  │  89 / 120    │  │     8       │       │  │
│ │ │   Total     │  │   Today      │  │   On Duty   │       │  │
│ │ └─────────────┘  └─────────────┘  └─────────────┘       │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Rooms (12) ─────────────────────────────────────────────┐  │
│ │                                           [+ Add Room]     │  │
│ │ ┌─────────────────────────────────────────────────────┐ │  │
│ │ │ Room │ Type        │ Status    │ Doctor    │Actions │ │  │
│ │ ├─────────────────────────────────────────────────────┤ │  │
│ │ │ 101  │ Consultation│ 🟢 Available │ -        │[View] │ │  │
│ │ │ 102  │ Consultation│ 🔴 Occupied  │Dr. Kumar │[View] │ │  │
│ │ │ 103  │ Consultation│ 🔴 Occupied  │Dr. Shah  │[View] │ │  │
│ │ │ 104  │ Consultation│ 🟢 Available │ -        │[View] │ │  │
│ │ │ 105  │ Consultation│ 🟠 Cleaning  │ -        │[View] │ │  │
│ │ │ ...  │ ...         │ ...        │ ...      │ ...   │ │  │
│ │ └─────────────────────────────────────────────────────┘ │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Today's Schedule ───────────────────────────────────────┐  │
│ │ 08:00 - 09:00  |  Dr. Kumar    |  8 appointments         │  │
│ │ 09:00 - 10:00  |  Dr. Sharma   |  10 appointments        │  │
│ │ 10:00 - 11:00  |  Dr. Patel    |  6 appointments         │  │
│ │ ...                                                       │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 10.5 Room Status Board (Real-time)

```
┌──────────────────────────────────────────────────────────────┐
│ Room Status Board        Unit: ICU - Block A    [Auto-refresh]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Legend: 🟢 Available  🔴 Occupied  🟠 Cleaning  🔵 Reserved  │
│         ⚪ Maintenance  ⚫ Blocked                            │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Room │ Bed │ Patient      │ Status     │ Duration │Act. │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 201  │ 1   │ John Doe     │ 🔴 Occupied │ 2d 4h    │[→] │ │
│ │      │     │ (MR-12345)   │            │          │    │ │
│ │      │     │ Dr. Kumar    │            │          │    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 202  │ 1   │ Jane Smith   │ 🔴 Occupied │ 5d 18h   │[→] │ │
│ │      │     │ (MR-12346)   │            │          │    │ │
│ │      │     │ Dr. Sharma   │            │          │    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 203  │ 1   │ -            │ 🟠 Cleaning │ 20min    │[✓] │ │
│ │      │     │              │            │          │    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 204  │ 1   │ -            │ 🟢 Available│ -        │[→] │ │
│ │      │     │              │            │          │    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 205  │ 1   │ -            │ 🔵 Reserved │ 2h       │[→] │ │
│ │      │     │ (MR-12348)   │            │          │    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ 206  │ 1   │ -            │ ⚪ Maintenance│ 4h      │[→] │ │
│ │      │     │ (Bio-med)    │            │          │    │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ ...  │ ... │ ...          │ ...        │ ...      │... │ │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌─ Summary ────────────────────────────────────────────────┐  │
│ │ Total Beds: 10                                           │  │
│ │ 🟢 Available: 2    🔴 Occupied: 5    🟠 Cleaning: 1      │  │
│ │ 🔵 Reserved: 1     ⚪ Maintenance: 1                      │  │
│ │ Occupancy Rate: 50%                                      │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ Last Updated: 2min ago                            [Refresh]  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Conclusion

This comprehensive workflow document provides:

1. **Complete Data Model** - All entities with relationships
2. **Step-by-Step Workflows** - For department, unit, room, and resource creation
3. **Integration Points** - How this module connects with others
4. **Business Rules** - Detailed validation and constraints
5. **API Specifications** - Complete REST API documentation
6. **UI/UX Flows** - Screen layouts and navigation

**Key Takeaways:**

- **Hierarchical Structure:** Branch → Department → Unit → Room → Resource
- **Specialty Master:** Pre-loaded, MCI-recognized specialties
- **Flexibility:** Supports any hospital size and structure
- **State Management:** Proper resource state transitions
- **Integration-Ready:** Clear APIs for OPD, IPD, OT, and other modules
- **User Permissions:** Role-based access control

**Next Steps:**
1. Review and approve this workflow
2. Implement database schema
3. Develop seed data for specialties and unit types
4. Build APIs following specifications
5. Create UI screens as per mockups
6. Integration with operational modules
7. Testing and validation

---

**Document Version Control:**
- v1.0 - Initial comprehensive workflow (Feb 6, 2026)
