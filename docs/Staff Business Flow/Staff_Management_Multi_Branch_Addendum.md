# ZypoCare Staff Management - Multi-Branch Sharing Addendum
**Critical Feature: Cross-Branch Doctor/Staff Sharing**

---

## Overview

For hospital chains with multiple branches, clinical staff (especially doctors) often provide services across multiple locations. This addendum covers the complete workflow for managing shared staff while maintaining a single master record.

---

## Updated Data Model for Multi-Branch Sharing

### Key Principle
**ONE staff master record, MULTIPLE branch assignments**

### Updated Staff Master Schema

```typescript
interface Staff {
  // ... all existing fields ...
  
  // UPDATED: Branch relationship
  organizationId: string;              // FK to Organization (NEW)
  primaryBranchId: string;             // Primary/home branch
  
  // REMOVED: Direct branchId (replaced with primaryBranchId)
  // branchId: string;  ❌ OLD APPROACH
  
  // ... rest of the fields remain same ...
}
```

### New Entity: Staff Branch Assignment

```typescript
interface StaffBranchAssignment {
  id: string;
  staffId: string;                     // FK to Staff
  branchId: string;                    // FK to Branch
  
  // Assignment Type
  isPrimaryBranch: boolean;            // Only one can be primary
  
  // Availability at this branch
  daysAvailable: DayOfWeek[];          // Which days available
  
  // Department at this branch
  departmentId?: string;               // May differ per branch
  role?: string;                       // May differ per branch
  
  // Consultation charges (may vary per branch)
  consultationChargeOverride?: number; // Override default charges
  
  // OPD Configuration (per branch)
  opdConfiguration?: {
    slotDuration: number;              // In minutes
    maxSlotsPerDay: number;
    consultationRooms: string[];       // Room IDs at this branch
  };
  
  // Working hours at this branch
  workingHours?: {
    [day: string]: {
      startTime: string;
      endTime: string;
      breakStart?: string;
      breakEnd?: string;
    };
  };
  
  // Validity
  effectiveDate: Date;
  endDate?: Date;                      // null for indefinite
  
  // Status
  isActive: boolean;
  
  // Administrative
  assignedBy: string;                  // Who authorized this assignment
  assignedDate: Date;
  approvedBy?: string;                 // Branch admin approval
  approvalDate?: Date;
  
  // Special Flags
  canAdmitPatients: boolean;           // At this branch
  canPerformSurgery: boolean;          // At this branch
  hasOTPrivileges: boolean;            // At this branch
  
  // Metadata
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}
```

### Updated Database Schema

```sql
-- Updated Staff Table
CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    primary_branch_id UUID NOT NULL REFERENCES branches(id),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    
    -- All other fields remain the same
    -- ... (same as before)
    
    -- CONSTRAINT: Employee code unique across organization
    UNIQUE(organization_id, employee_code)
);

-- NEW: Staff Branch Assignments
CREATE TABLE staff_branch_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id),
    
    -- Assignment Type
    is_primary_branch BOOLEAN DEFAULT false,
    
    -- Availability
    days_available JSONB,              -- Array of days
    
    -- Department at this branch
    department_id UUID REFERENCES departments(id),
    role VARCHAR(100),
    
    -- Consultation charges override
    consultation_charge_override DECIMAL(10,2),
    
    -- OPD Configuration
    opd_configuration JSONB,
    
    -- Working hours
    working_hours JSONB,
    
    -- Validity
    effective_date DATE NOT NULL,
    end_date DATE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Administrative
    assigned_by UUID REFERENCES users(id),
    assigned_date DATE NOT NULL,
    approved_by UUID REFERENCES users(id),
    approval_date DATE,
    
    -- Privileges at this branch
    can_admit_patients BOOLEAN DEFAULT false,
    can_perform_surgery BOOLEAN DEFAULT false,
    has_ot_privileges BOOLEAN DEFAULT false,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    
    -- CONSTRAINTS
    UNIQUE(staff_id, branch_id),
    
    -- Only one primary branch per staff
    CONSTRAINT unique_primary_branch 
        EXCLUDE (staff_id WITH =) 
        WHERE (is_primary_branch = true)
);

-- Indexes
CREATE INDEX idx_staff_branch_assign_staff ON staff_branch_assignments(staff_id);
CREATE INDEX idx_staff_branch_assign_branch ON staff_branch_assignments(branch_id);
CREATE INDEX idx_staff_branch_assign_active ON staff_branch_assignments(is_active);
CREATE INDEX idx_staff_branch_assign_primary ON staff_branch_assignments(is_primary_branch);
```

---

## Workflow: Assigning Doctor to Multiple Branches

### Scenario
**Dr. Rajesh Kumar Sharma** (Cardiologist) works at:
- **Primary:** Bangalore Main Hospital (Mon, Tue, Wed)
- **Secondary:** Bangalore Satellite Clinic (Thu, Fri)
- **Secondary:** Mysore Hospital (Sat)

### Workflow Steps

```
┌─────────────────────────────────────────────────────────────────┐
│         MULTI-BRANCH DOCTOR ASSIGNMENT WORKFLOW                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: CREATE MASTER STAFF RECORD (ONE TIME)                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │ During initial onboarding:                        │          │
│  │                                                   │          │
│  │ Organization: Zypo Hospitals Pvt Ltd              │          │
│  │ Primary Branch: Bangalore Main Hospital           │          │
│  │ Employee Code: EMP-ZYPO-CARD-0042                 │          │
│  │   (Org-level unique code)                         │          │
│  │                                                   │          │
│  │ Name: Dr. Rajesh Kumar Sharma                     │          │
│  │ Designation: Consultant Cardiologist              │          │
│  │ Specialty: Cardiology                             │          │
│  │                                                   │          │
│  │ All credentials attached to THIS record only      │          │
│  │ ✓ MCI Registration                                │          │
│  │ ✓ Educational Certificates                        │          │
│  │ ✓ HPR ID                                          │          │
│  │ ✓ Professional Indemnity Insurance                │          │
│  │                                                   │          │
│  │ Status: Master record created                     │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  STEP 2: PRIMARY BRANCH ASSIGNMENT (AUTO-CREATED)                │
│  ┌───────────────────────────────────────────────────┐          │
│  │ System automatically creates:                     │          │
│  │                                                   │          │
│  │ Staff Branch Assignment #1:                       │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Branch: Bangalore Main Hospital         │       │          │
│  │ │ Is Primary: ✓ YES                       │       │          │
│  │ │ Department: Cardiology OPD              │       │          │
│  │ │ Role: Senior Consultant                 │       │          │
│  │ │                                         │       │          │
│  │ │ Days Available: Mon, Tue, Wed           │       │          │
│  │ │                                         │       │          │
│  │ │ Working Hours:                          │       │          │
│  │ │   Mon: 09:00 - 17:00                    │       │          │
│  │ │   Tue: 09:00 - 17:00                    │       │          │
│  │ │   Wed: 09:00 - 14:00                    │       │          │
│  │ │                                         │       │          │
│  │ │ OPD Configuration:                      │       │          │
│  │ │   Slot Duration: 15 minutes             │       │          │
│  │ │   Max Slots/Day: 32                     │       │          │
│  │ │   Consultation Rooms: RM-201, RM-202    │       │          │
│  │ │                                         │       │          │
│  │ │ Consultation Charge: ₹800               │       │          │
│  │ │                                         │       │          │
│  │ │ Privileges at this branch:              │       │          │
│  │ │   [✓] Can Admit Patients                │       │          │
│  │ │   [✓] Can Perform Surgery               │       │          │
│  │ │   [✓] Has OT Privileges                 │       │          │
│  │ │                                         │       │          │
│  │ │ Status: ✓ Active                        │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  STEP 3: ADD SECONDARY BRANCH #1                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │ User Action:                                      │          │
│  │ • Navigate to Dr. Rajesh's profile                │          │
│  │ • Click "Branch Assignments" tab                  │          │
│  │ • Click "+ Add Branch Assignment"                 │          │
│  │                                                   │          │
│  │ Form:                                             │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ Select Branch:                          │       │          │
│  │ │   [Bangalore Satellite Clinic ▼]        │       │          │
│  │ │                                         │       │          │
│  │ │ Assignment Type:                        │       │          │
│  │ │   ○ Primary Branch                      │       │          │
│  │ │   ● Secondary/Visiting                  │       │          │
│  │ │                                         │       │          │
│  │ │ Department at this branch:              │       │          │
│  │ │   [Cardiology OPD ▼]                    │       │          │
│  │ │                                         │       │          │
│  │ │ Days Available:                         │       │          │
│  │ │   [ ] Mon [✓] Thu                       │       │          │
│  │ │   [ ] Tue [✓] Fri                       │       │          │
│  │ │   [ ] Wed [ ] Sat                       │       │          │
│  │ │   [ ] Sun                               │       │          │
│  │ │                                         │       │          │
│  │ │ Working Hours on Selected Days:         │       │          │
│  │ │   Thu: [16:00] - [20:00]                │       │          │
│  │ │   Fri: [16:00] - [20:00]                │       │          │
│  │ │                                         │       │          │
│  │ │ OPD Configuration:                      │       │          │
│  │ │   Slot Duration: [15] minutes           │       │          │
│  │ │   Max Slots/Day: [16]                   │       │          │
│  │ │   Consultation Rooms:                   │       │          │
│  │ │     [RM-CLINIC-101 ▼] [+ Add]           │       │          │
│  │ │                                         │       │          │
│  │ │ Consultation Charge:                    │       │          │
│  │ │   ○ Use Default (₹800)                  │       │          │
│  │ │   ● Override: [₹600]                    │       │          │
│  │ │     (Lower for satellite clinic)        │       │          │
│  │ │                                         │       │          │
│  │ │ Clinical Privileges at this branch:     │       │          │
│  │ │   [✓] Can Admit Patients                │       │          │
│  │ │   [ ] Can Perform Surgery (no OT here)  │       │          │
│  │ │   [ ] Has OT Privileges                 │       │          │
│  │ │                                         │       │          │
│  │ │ Effective From: [01-Feb-2025]           │       │          │
│  │ │ End Date: [____] (Leave blank if ongoing)│      │          │
│  │ │                                         │       │          │
│  │ │ Assigned By: [Current User]             │       │          │
│  │ │ Approval Required From:                 │       │          │
│  │ │   [Branch Admin - Satellite Clinic]     │       │          │
│  │ │                                         │       │          │
│  │ │ [Cancel] [Save & Request Approval]      │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ System Actions:                                   │          │
│  │ 1. Creates staff_branch_assignment record        │          │
│  │ 2. Status: PENDING_APPROVAL                       │          │
│  │ 3. Sends notification to Satellite Clinic Admin   │          │
│  │ 4. Email/SMS to Dr. Rajesh about assignment       │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  STEP 4: BRANCH ADMIN APPROVAL                                   │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Branch Admin (Satellite Clinic) receives:         │          │
│  │                                                   │          │
│  │ Notification:                                     │          │
│  │ ┌─────────────────────────────────────────┐       │          │
│  │ │ 🔔 New Staff Assignment Request          │       │          │
│  │ │                                         │       │          │
│  │ │ Dr. Rajesh Kumar Sharma                 │       │          │
│  │ │ Consultant Cardiologist                 │       │          │
│  │ │                                         │       │          │
│  │ │ Requested for: Thu, Fri (16:00-20:00)   │       │          │
│  │ │ Department: Cardiology OPD              │       │          │
│  │ │ Consultation: ₹600 per visit            │       │          │
│  │ │                                         │       │          │
│  │ │ Credentials:                            │       │          │
│  │ │ ✓ MCI Verified                          │       │          │
│  │ │ ✓ Indemnity Insurance Active            │       │          │
│  │ │ ✓ All credentials valid                 │       │          │
│  │ │                                         │       │          │
│  │ │ [View Full Profile]                     │       │          │
│  │ │                                         │       │          │
│  │ │ Action:                                 │       │          │
│  │ │ [✓ Approve] [✗ Reject] [? Query]        │       │          │
│  │ └─────────────────────────────────────────┘       │          │
│  │                                                   │          │
│  │ On Approval:                                      │          │
│  │ • Assignment status: PENDING → ACTIVE             │          │
│  │ • Doctor visible in Satellite Clinic staff list   │          │
│  │ • OPD slots auto-generated for Thu, Fri           │          │
│  │ • Doctor can start seeing patients                │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  STEP 5: ADD SECONDARY BRANCH #2 (Mysore)                        │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Repeat Step 3 for Mysore Hospital:                │          │
│  │                                                   │          │
│  │ Branch: Mysore Hospital                           │          │
│  │ Days Available: Saturday only                     │          │
│  │ Working Hours: 09:00 - 14:00                      │          │
│  │ Consultation Charge: ₹1000 (premium for visiting) │          │
│  │ Privileges: Consultation only (no surgery)        │          │
│  │                                                   │          │
│  │ After approval: Active                            │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
│  RESULT: ONE DOCTOR, THREE LOCATIONS                             │
│  ┌───────────────────────────────────────────────────┐          │
│  │ Dr. Rajesh Kumar Sharma                           │          │
│  │ Employee Code: EMP-ZYPO-CARD-0042 (Single)        │          │
│  │                                                   │          │
│  │ Branch Assignments:                               │          │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          │          │
│  │                                                   │          │
│  │ 1. ⭐ Bangalore Main (Primary)                    │          │
│  │    Mon-Wed | ₹800 | Full Privileges              │          │
│  │    Status: Active                                 │          │
│  │                                                   │          │
│  │ 2. 📍 Bangalore Satellite                         │          │
│  │    Thu-Fri | ₹600 | OPD Only                      │          │
│  │    Status: Active                                 │          │
│  │                                                   │          │
│  │ 3. 📍 Mysore Hospital                             │          │
│  │    Saturday | ₹1000 | OPD Only                    │          │
│  │    Status: Active                                 │          │
│  │                                                   │          │
│  │ All branches use SAME credentials                 │          │
│  │ No duplicate profiles needed                      │          │
│  └───────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Updated API Endpoints

```typescript
// Get staff with all branch assignments
GET /api/v1/staff/:id/branch-assignments
Response: {
  staff: Staff;
  branchAssignments: StaffBranchAssignment[];
  primary: StaffBranchAssignment;
  secondary: StaffBranchAssignment[];
}

// Add branch assignment
POST /api/v1/staff/:id/branch-assignments
Body: {
  branchId: string;
  isPrimaryBranch: boolean;
  daysAvailable: DayOfWeek[];
  departmentId?: string;
  role?: string;
  consultationChargeOverride?: number;
  opdConfiguration?: {
    slotDuration: number;
    maxSlotsPerDay: number;
    consultationRooms: string[];
  };
  workingHours?: object;
  effectiveDate: Date;
  endDate?: Date;
  canAdmitPatients: boolean;
  canPerformSurgery: boolean;
  hasOTPrivileges: boolean;
}
Response: StaffBranchAssignment

// Approve/Reject branch assignment
PATCH /api/v1/staff-branch-assignments/:id/approval
Body: {
  approvalStatus: 'APPROVED' | 'REJECTED';
  remarks?: string;
}
Response: StaffBranchAssignment

// Get doctors available at a specific branch
GET /api/v1/branches/:branchId/staff
Query Params:
  - staffType: 'DOCTOR_CONSULTANT' | etc.
  - specialty: string
  - department: string
  - dayOfWeek: 'MONDAY' | 'TUESDAY' | etc.
  - isActive: boolean
Response: {
  staff: Array<{
    staffId: string;
    staffDetails: Staff;
    branchAssignment: StaffBranchAssignment;
    isPrimary: boolean;
    availability: object;
  }>;
}

// Update branch assignment
PATCH /api/v1/staff-branch-assignments/:id
Body: Partial<StaffBranchAssignment>
Response: StaffBranchAssignment

// Deactivate branch assignment
DELETE /api/v1/staff-branch-assignments/:id
Response: { success: boolean; message: string; }
```

---

## Business Rules for Multi-Branch Assignments

```
MULTI-BRANCH ASSIGNMENT RULES

1. PRIMARY BRANCH RULES
   ✓ Every staff must have exactly ONE primary branch
   ✓ Primary branch cannot be removed (transfer only)
   ✓ Primary branch assignment is auto-created on staff creation
   ✓ Primary branch should be the main working location

2. SECONDARY BRANCH RULES
   ✓ Staff can have 0 to N secondary branches
   ✓ Each secondary branch requires approval from branch admin
   ✓ Secondary branches are optional assignments
   ✓ Can be added/removed without affecting primary

3. AVAILABILITY RULES
   ✓ Days cannot overlap across branches for same staff
   ✓ System validates: No staff can be in 2 branches same day/time
   ✓ Example: If Mon assigned to Branch A, cannot assign Mon to Branch B
   ✓ Weekend assignments allowed across branches (Sat/Sun flexibility)

4. DEPARTMENT RULES
   ✓ Department at each branch can differ
   ✓ Same specialty, different departments allowed
   ✓ Example: "Cardiology OPD" at Main, "General OPD" at Satellite
   ✓ Department must belong to the branch being assigned

5. CREDENTIAL RULES (CRITICAL)
   ✓ Credentials attached to staff master record only
   ✓ ALL branches use SAME credentials
   ✓ No duplication of MCI/licenses/degrees
   ✓ Expiry alerts sent once (not per branch)
   ✓ HPR verification done once at org level

6. CONSULTATION CHARGE RULES
   ✓ Each branch can have different consultation charges
   ✓ Default charge from staff profile
   ✓ Branch-specific override allowed
   ✓ Used in billing at respective branch

7. PRIVILEGE RULES
   ✓ Clinical privileges can vary per branch
   ✓ May have surgical privileges at Main, OPD only at Satellite
   ✓ OT access granted per branch basis
   ✓ Admission privileges per branch

8. SCHEDULE RULES
   ✓ Each branch maintains own schedule for the doctor
   ✓ OPD slot generation per branch
   ✓ Working hours can differ per branch
   ✓ Break times can differ per branch

9. ATTENDANCE RULES
   ✓ Attendance marked at each branch separately
   ✓ Biometric enrollment at all assigned branches
   ✓ Attendance consolidated for payroll
   ✓ Location-wise attendance reports

10. APPROVAL RULES
    ✓ Primary branch assignment: No approval needed
    ✓ Secondary branch assignment: Branch admin approval mandatory
    ✓ Can reject if:
      - No vacancy in department
      - Budget constraints
      - Facility unavailable
    ✓ Once approved, can start immediately

11. DEACTIVATION RULES
    ✓ Primary branch cannot be deactivated (transfer first)
    ✓ Secondary branches can be deactivated anytime
    ✓ Notice period recommended (15-30 days)
    ✓ Existing appointments honored
    ✓ Patients notified of doctor unavailability

12. REPORTING RULES
    ✓ Branch-wise patient count
    ✓ Branch-wise revenue attribution
    ✓ Consolidated performance across all branches
    ✓ Cross-branch referral tracking
```

---

## Updated UI/UX Flow

### Staff Profile Page - Branch Assignments Tab

```
┌──────────────────────────────────────────────────────────────┐
│ ← Dr. Rajesh Kumar Sharma                                    │
│ Employee Code: EMP-ZYPO-CARD-0042        [Edit Profile] [⋮]  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ [Overview] [Credentials] [Privileges] [Branch Assignments]   │
│            [Schedule] [Training] [Performance]                │
│                                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                               │
│ BRANCH ASSIGNMENTS                     [+ Add Branch]         │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ ⭐ Bangalore Main Hospital (Primary)                    │  │
│ │ ┌───────────────────────────────────────────────────┐   │  │
│ │ │ Department: Cardiology OPD                        │   │  │
│ │ │ Role: Senior Consultant                           │   │  │
│ │ │                                                   │   │  │
│ │ │ Availability: Mon, Tue, Wed                       │   │  │
│ │ │ Hours: 09:00 - 17:00 (Mon-Tue), 09:00-14:00 (Wed)│   │  │
│ │ │                                                   │   │  │
│ │ │ OPD Slots: 32 per day | 15 min each              │   │  │
│ │ │ Consultation: ₹800 per visit                      │   │  │
│ │ │                                                   │   │  │
│ │ │ Privileges: ✓ Admit ✓ Surgery ✓ OT               │   │  │
│ │ │                                                   │   │  │
│ │ │ Status: ✓ Active since 01-Jan-2025               │   │  │
│ │ │                                                   │   │  │
│ │ │ Stats This Month:                                 │   │  │
│ │ │ • Patients Seen: 287                              │   │  │
│ │ │ • Admissions: 12                                  │   │  │
│ │ │ • Surgeries: 5                                    │   │  │
│ │ │                                                   │   │  │
│ │ │ [Edit Assignment] [View Schedule] [Statistics]    │   │  │
│ │ └───────────────────────────────────────────────────┘   │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 📍 Bangalore Satellite Clinic                           │  │
│ │ ┌───────────────────────────────────────────────────┐   │  │
│ │ │ Department: Cardiology OPD                        │   │  │
│ │ │ Role: Visiting Consultant                         │   │  │
│ │ │                                                   │   │  │
│ │ │ Availability: Thu, Fri                            │   │  │
│ │ │ Hours: 16:00 - 20:00                              │   │  │
│ │ │                                                   │   │  │
│ │ │ OPD Slots: 16 per day | 15 min each              │   │  │
│ │ │ Consultation: ₹600 per visit                      │   │  │
│ │ │                                                   │   │  │
│ │ │ Privileges: ✓ Admit ✗ Surgery ✗ OT               │   │  │
│ │ │                                                   │   │  │
│ │ │ Status: ✓ Active since 01-Feb-2025               │   │  │
│ │ │ Approved By: Mr. Suresh (Branch Admin)            │   │  │
│ │ │                                                   │   │  │
│ │ │ Stats This Month:                                 │   │  │
│ │ │ • Patients Seen: 124                              │   │  │
│ │ │ • Admissions: 3                                   │   │  │
│ │ │                                                   │   │  │
│ │ │ [Edit Assignment] [View Schedule] [Deactivate]    │   │  │
│ │ └───────────────────────────────────────────────────┘   │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ 📍 Mysore Hospital                                      │  │
│ │ ┌───────────────────────────────────────────────────┐   │  │
│ │ │ Department: General OPD                           │   │  │
│ │ │ Role: Visiting Specialist                         │   │  │
│ │ │                                                   │   │  │
│ │ │ Availability: Saturday only                       │   │  │
│ │ │ Hours: 09:00 - 14:00                              │   │  │
│ │ │                                                   │   │  │
│ │ │ OPD Slots: 20 per day | 15 min each              │   │  │
│ │ │ Consultation: ₹1000 per visit (Premium)           │   │  │
│ │ │                                                   │   │  │
│ │ │ Privileges: ✓ Admit ✗ Surgery ✗ OT               │   │  │
│ │ │                                                   │   │  │
│ │ │ Status: ✓ Active since 15-Feb-2025               │   │  │
│ │ │ Approved By: Dr. Pradeep (Medical Director)       │   │  │
│ │ │                                                   │   │  │
│ │ │ Stats This Month:                                 │   │  │
│ │ │ • Patients Seen: 76                               │   │  │
│ │ │ • Admissions: 2                                   │   │  │
│ │ │                                                   │   │  │
│ │ │ [Edit Assignment] [View Schedule] [Deactivate]    │   │  │
│ │ └───────────────────────────────────────────────────┘   │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ WEEKLY SCHEDULE OVERVIEW                                │  │
│ ├─────────────────────────────────────────────────────────┤  │
│ │ Mon: 🏥 Bangalore Main (09:00-17:00)                    │  │
│ │ Tue: 🏥 Bangalore Main (09:00-17:00)                    │  │
│ │ Wed: 🏥 Bangalore Main (09:00-14:00)                    │  │
│ │ Thu: 🏢 Bangalore Satellite (16:00-20:00)               │  │
│ │ Fri: 🏢 Bangalore Satellite (16:00-20:00)               │  │
│ │ Sat: 🏥 Mysore Hospital (09:00-14:00)                   │  │
│ │ Sun: 🏖️ Off                                             │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ CONSOLIDATED STATISTICS (All Branches)                  │  │
│ ├─────────────────────────────────────────────────────────┤  │
│ │ This Month:                                             │  │
│ │ • Total Patients: 487                                   │  │
│ │ • Total Admissions: 17                                  │  │
│ │ • Total Surgeries: 5                                    │  │
│ │ • Revenue Generated: ₹3,89,400                          │  │
│ │                                                         │  │
│ │ Branch-wise Split:                                      │  │
│ │ • Bangalore Main: 59% (287 patients)                    │  │
│ │ • Satellite Clinic: 25% (124 patients)                  │  │
│ │ • Mysore: 16% (76 patients)                             │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Key Benefits of This Approach

### 1. **Single Source of Truth**
```
✅ One master record
✅ One employee code
✅ One set of credentials
✅ One HPR verification
✅ One indemnity insurance
✅ Centralized updates
```

### 2. **Flexibility**
```
✅ Different charges per branch
✅ Different schedules per branch
✅ Different privileges per branch
✅ Different departments per branch
```

### 3. **Compliance**
```
✅ No duplicate credentials
✅ Single point for expiry tracking
✅ Unified compliance reporting
✅ Consolidated NABH records
```

### 4. **Operational Efficiency**
```
✅ Branch admins control their assignments
✅ Doctors visible across assigned branches
✅ Patients can book at any assigned branch
✅ Consolidated performance tracking
```

### 5. **Reporting**
```
✅ Doctor performance across all branches
✅ Revenue attribution per branch
✅ Utilization analysis
✅ Cross-branch patient referrals
```

---

## Migration Guide (If Existing System Has Duplicates)

### For hospitals already using the system with duplicate records:

```
MIGRATION STEPS:

1. IDENTIFY DUPLICATES
   • Run SQL: Find staff with same name + phone + credentials
   • Generate duplicate pairs list
   • Manual verification required

2. DESIGNATE MASTER RECORD
   • Select one record as master (usually from main branch)
   • Mark others for merge

3. DATA CONSOLIDATION
   • Merge schedules into branch assignments
   • Merge appointments (update staffId)
   • Merge prescriptions (update doctorId)
   • Merge billing records
   • Merge performance data

4. CREATE BRANCH ASSIGNMENTS
   • Convert duplicate records → branch assignments
   • Preserve all branch-specific data
   • Set one as primary

5. UPDATE REFERENCES
   • Update all foreign keys to master staffId
   • Update user accounts (merge logins)
   • Update privileges
   • Update training records

6. ARCHIVE & CLEAN
   • Soft delete duplicate records
   • Archive for audit trail
   • Verify data integrity

7. VALIDATION
   • Doctor can log in with single account
   • Sees all branches in profile
   • Appointments work across all branches
   • Billing correctly attributes

TIMELINE: 2-4 weeks depending on data volume
```

---

## Summary

This multi-branch sharing model ensures:

✅ **No Duplicate Entries** - One master record per staff  
✅ **Single Credential Management** - Managed centrally  
✅ **Flexible Assignments** - Work across multiple branches  
✅ **Branch Autonomy** - Each branch controls their assignments  
✅ **Compliance** - Unified tracking and reporting  
✅ **Scalability** - Add/remove branches easily  
✅ **Audit Trail** - Complete history of all assignments  

---

**Document End**

This addendum should be implemented alongside the main Staff Management workflow to enable complete multi-branch doctor sharing functionality.
