export type SeedDrugRow = {
  drugCode?: string;
  genericName: string;
  brandName?: string | null;
  manufacturer?: string | null;
  category: string; // TABLET/CAPSULE/INJECTION/.../OTHER
  dosageForm?: string | null;
  strength?: string | null;
  route?: string | null; // ORAL/IV/IM/...
  therapeuticClass?: string | null;
  pharmacologicalClass?: string | null;
  scheduleClass?: string; // GENERAL/H/H1/X/G
  isNarcotic?: boolean;
  isPsychotropic?: boolean;
  isControlled?: boolean;
  isAntibiotic?: boolean;
  isHighAlert?: boolean;
  isLasa?: boolean;
  mrp?: number | null;
  purchasePrice?: number | null;
  hsnCode?: string | null;
  gstRate?: number | null;
  packSize?: number | null;
  defaultDosage?: string | null;
  maxDailyDose?: string | null;
  formularyStatus?: string; // APPROVED/RESTRICTED/NON_FORMULARY
};

export const INDIA_DRUG_DB_SAMPLE: SeedDrugRow[] = [
  {
    genericName: "Paracetamol",
    brandName: "Dolo 650",
    manufacturer: "Micro Labs",
    category: "TABLET",
    dosageForm: "Tablet",
    strength: "650 mg",
    route: "ORAL",
    therapeuticClass: "Analgesic/Antipyretic",
    scheduleClass: "GENERAL",
    isAntibiotic: false,
    isHighAlert: false,
    isLasa: false,
    gstRate: 12,
    formularyStatus: "APPROVED",
  },
  {
    genericName: "Amoxicillin",
    brandName: "Amoxil",
    manufacturer: "GSK",
    category: "CAPSULE",
    dosageForm: "Capsule",
    strength: "500 mg",
    route: "ORAL",
    therapeuticClass: "Antibiotic (Penicillin)",
    scheduleClass: "H",
    isAntibiotic: true,
    gstRate: 12,
    formularyStatus: "RESTRICTED",
  },
  {
    genericName: "Ceftriaxone",
    brandName: "Rocephin",
    manufacturer: "Roche",
    category: "INJECTION",
    dosageForm: "Injection",
    strength: "1 g",
    route: "IV",
    therapeuticClass: "Antibiotic (Cephalosporin)",
    scheduleClass: "H1",
    isAntibiotic: true,
    isHighAlert: false,
    gstRate: 12,
    formularyStatus: "RESTRICTED",
  },
  {
    genericName: "Insulin Regular",
    brandName: "Actrapid",
    manufacturer: "Novo Nordisk",
    category: "INJECTION",
    dosageForm: "Injection",
    strength: "100 IU/mL",
    route: "SC",
    therapeuticClass: "Antidiabetic",
    scheduleClass: "H",
    isHighAlert: true,
    gstRate: 12,
    formularyStatus: "APPROVED",
  },
  {
    genericName: "Heparin",
    brandName: null,
    manufacturer: null,
    category: "INJECTION",
    dosageForm: "Injection",
    strength: "5000 IU/mL",
    route: "IV",
    therapeuticClass: "Anticoagulant",
    scheduleClass: "H",
    isHighAlert: true,
    gstRate: 12,
    formularyStatus: "RESTRICTED",
  },
  {
    genericName: "Diazepam",
    brandName: null,
    manufacturer: null,
    category: "TABLET",
    dosageForm: "Tablet",
    strength: "5 mg",
    route: "ORAL",
    therapeuticClass: "Benzodiazepine",
    scheduleClass: "H",
    isControlled: true,
    isPsychotropic: true,
    gstRate: 12,
    formularyStatus: "RESTRICTED",
  },
  {
    genericName: "Morphine",
    brandName: null,
    manufacturer: null,
    category: "INJECTION",
    dosageForm: "Injection",
    strength: "10 mg/mL",
    route: "IV",
    therapeuticClass: "Opioid Analgesic",
    scheduleClass: "X",
    isNarcotic: true,
    isControlled: true,
    isHighAlert: true,
    gstRate: 12,
    formularyStatus: "RESTRICTED",
  },
];
