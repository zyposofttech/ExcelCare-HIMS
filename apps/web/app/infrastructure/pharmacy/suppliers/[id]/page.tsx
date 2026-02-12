"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RequirePerm } from "@/components/RequirePerm";
import { useBranchContext } from "@/lib/branch/useBranchContext";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PharmacyStore {
  id: string;
  storeCode: string;
  storeName: string;
  storeType: string;
  status: string;
}

interface StoreMapping {
  pharmacyStore: PharmacyStore;
}

interface Supplier {
  id: string;
  branchId: string;
  supplierCode: string;
  supplierName: string;
  status: "ACTIVE" | "BLACKLISTED" | "INACTIVE";
  gstin: string | null;
  drugLicenseNumber: string | null;
  drugLicenseExpiry: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  paymentTermsDays: number | null;
  discountTerms: string | null;
  deliveryLeadTimeDays: number | null;
  productCategories: string[];
  rating: number | null;
  storeMappings: StoreMapping[];
  createdAt: string;
  updatedAt: string;
}

interface EditForm {
  supplierName: string;
  status: "ACTIVE" | "BLACKLISTED" | "INACTIVE";
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  drugLicenseNumber: string;
  drugLicenseExpiry: string;
  paymentTermsDays: string;
  discountTerms: string;
  deliveryLeadTimeDays: string;
  rating: string;
}

function statusBadgeVariant(status: string) {
  switch (status) {
    case "ACTIVE":
      return "default" as const;
    case "BLACKLISTED":
      return "destructive" as const;
    case "INACTIVE":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function renderRating(rating: number | null) {
  if (rating === null || rating === undefined) return "Not rated";
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const stars: string[] = [];
  for (let i = 0; i < full; i++) stars.push("★");
  if (half) stars.push("½");
  const empty = 5 - full - (half ? 1 : 0);
  for (let i = 0; i < empty; i++) stars.push("☆");
  return `${stars.join("")} (${rating.toFixed(1)})`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SupplierDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { branch } = useBranchContext();
  const { toast } = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    supplierName: "",
    status: "ACTIVE",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    gstin: "",
    drugLicenseNumber: "",
    drugLicenseExpiry: "",
    paymentTermsDays: "",
    discountTerms: "",
    deliveryLeadTimeDays: "",
    rating: "",
  });

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/infrastructure/pharmacy/suppliers/${id}`);
      setSupplier(data);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to load supplier details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && branch?.id) {
      fetchSupplier();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, branch?.id]);

  const openEditDialog = () => {
    if (!supplier) return;
    setEditForm({
      supplierName: supplier.supplierName || "",
      status: supplier.status,
      contactPerson: supplier.contactPerson || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      gstin: supplier.gstin || "",
      drugLicenseNumber: supplier.drugLicenseNumber || "",
      drugLicenseExpiry: supplier.drugLicenseExpiry
        ? supplier.drugLicenseExpiry.slice(0, 10)
        : "",
      paymentTermsDays:
        supplier.paymentTermsDays !== null
          ? String(supplier.paymentTermsDays)
          : "",
      discountTerms: supplier.discountTerms || "",
      deliveryLeadTimeDays:
        supplier.deliveryLeadTimeDays !== null
          ? String(supplier.deliveryLeadTimeDays)
          : "",
      rating: supplier.rating !== null ? String(supplier.rating) : "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const body: Record<string, any> = {
        supplierName: editForm.supplierName,
        status: editForm.status,
        contactPerson: editForm.contactPerson || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        address: editForm.address || null,
        gstin: editForm.gstin || null,
        drugLicenseNumber: editForm.drugLicenseNumber || null,
        drugLicenseExpiry: editForm.drugLicenseExpiry || null,
        paymentTermsDays: editForm.paymentTermsDays
          ? parseInt(editForm.paymentTermsDays, 10)
          : null,
        discountTerms: editForm.discountTerms || null,
        deliveryLeadTimeDays: editForm.deliveryLeadTimeDays
          ? parseInt(editForm.deliveryLeadTimeDays, 10)
          : null,
        rating: editForm.rating ? parseFloat(editForm.rating) : null,
      };

      const updated = await apiFetch(
        `/infrastructure/pharmacy/suppliers/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        }
      );

      setSupplier(updated);
      setEditOpen(false);
      toast({
        title: "Success",
        description: "Supplier updated successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err?.message || "Failed to update supplier.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof EditForm, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppShell>
      <RequirePerm perm="INFRA_PHARMACY_SUPPLIER_READ">
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/infrastructure/pharmacy/suppliers">
                <Button variant="outline" size="sm">
                  ← Back
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {loading
                    ? "Loading..."
                    : supplier?.supplierName || "Supplier Detail"}
                </h1>
                {supplier && (
                  <p className="text-sm text-muted-foreground">
                    Code: {supplier.supplierCode}
                  </p>
                )}
              </div>
            </div>
            {supplier && (
              <Button onClick={openEditDialog}>Edit Supplier</Button>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading supplier details...</p>
            </div>
          )}

          {!loading && !supplier && (
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Supplier not found.</p>
            </div>
          )}

          {!loading && supplier && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Supplier identity and status
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Supplier Code
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.supplierCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Supplier Name
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.supplierName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <Badge variant={statusBadgeVariant(supplier.status)}>
                      {supplier.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Rating
                    </span>
                    <span className="text-sm font-medium">
                      {renderRating(supplier.rating)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Product Categories
                    </span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {supplier.productCategories &&
                      supplier.productCategories.length > 0 ? (
                        supplier.productCategories.map((cat, idx) => (
                          <Badge key={idx} variant="outline">
                            {cat}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Created
                    </span>
                    <span className="text-sm">
                      {formatDate(supplier.createdAt)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Last Updated
                    </span>
                    <span className="text-sm">
                      {formatDate(supplier.updatedAt)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Contact */}
              <Card>
                <CardHeader>
                  <CardTitle>Contact Information</CardTitle>
                  <CardDescription>
                    Primary contact details for this supplier
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Contact Person
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.contactPerson || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Phone
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.phone || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Email
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.email || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Address
                    </span>
                    <span className="text-sm font-medium text-right max-w-[60%]">
                      {supplier.address || "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* License & Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle>License & Compliance</CardTitle>
                  <CardDescription>
                    Regulatory and tax information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">GSTIN</span>
                    <span className="text-sm font-medium font-mono">
                      {supplier.gstin || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Drug License Number
                    </span>
                    <span className="text-sm font-medium font-mono">
                      {supplier.drugLicenseNumber || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Drug License Expiry
                    </span>
                    <span className="text-sm font-medium">
                      {formatDate(supplier.drugLicenseExpiry)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Terms */}
              <Card>
                <CardHeader>
                  <CardTitle>Terms & Conditions</CardTitle>
                  <CardDescription>
                    Payment, discount, and delivery terms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Payment Terms
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.paymentTermsDays !== null
                        ? `${supplier.paymentTermsDays} days`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Discount Terms
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.discountTerms || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">
                      Delivery Lead Time
                    </span>
                    <span className="text-sm font-medium">
                      {supplier.deliveryLeadTimeDays !== null
                        ? `${supplier.deliveryLeadTimeDays} days`
                        : "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Store Mappings */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Store Mappings</CardTitle>
                  <CardDescription>
                    Pharmacy stores linked to this supplier
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {supplier.storeMappings &&
                  supplier.storeMappings.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Store Code</TableHead>
                          <TableHead>Store Name</TableHead>
                          <TableHead>Store Type</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplier.storeMappings.map((mapping) => (
                          <TableRow key={mapping.pharmacyStore.id}>
                            <TableCell className="font-mono text-sm">
                              {mapping.pharmacyStore.storeCode}
                            </TableCell>
                            <TableCell>
                              {mapping.pharmacyStore.storeName}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {mapping.pharmacyStore.storeType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={statusBadgeVariant(
                                  mapping.pharmacyStore.status
                                )}
                              >
                                {mapping.pharmacyStore.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No stores mapped to this supplier.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Edit Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Supplier</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-supplierName">Supplier Name</Label>
                  <Input
                    id="edit-supplierName"
                    value={editForm.supplierName}
                    onChange={(e) =>
                      updateField("supplierName", e.target.value)
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(val) =>
                      updateField(
                        "status",
                        val as "ACTIVE" | "BLACKLISTED" | "INACTIVE"
                      )
                    }
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-contactPerson">Contact Person</Label>
                    <Input
                      id="edit-contactPerson"
                      value={editForm.contactPerson}
                      onChange={(e) =>
                        updateField("contactPerson", e.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      value={editForm.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input
                    id="edit-address"
                    value={editForm.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-gstin">GSTIN</Label>
                    <Input
                      id="edit-gstin"
                      value={editForm.gstin}
                      onChange={(e) => updateField("gstin", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-drugLicenseNumber">
                      Drug License Number
                    </Label>
                    <Input
                      id="edit-drugLicenseNumber"
                      value={editForm.drugLicenseNumber}
                      onChange={(e) =>
                        updateField("drugLicenseNumber", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-drugLicenseExpiry">
                    Drug License Expiry
                  </Label>
                  <Input
                    id="edit-drugLicenseExpiry"
                    type="date"
                    value={editForm.drugLicenseExpiry}
                    onChange={(e) =>
                      updateField("drugLicenseExpiry", e.target.value)
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-paymentTermsDays">
                      Payment Terms (days)
                    </Label>
                    <Input
                      id="edit-paymentTermsDays"
                      type="number"
                      value={editForm.paymentTermsDays}
                      onChange={(e) =>
                        updateField("paymentTermsDays", e.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-discountTerms">Discount Terms</Label>
                    <Input
                      id="edit-discountTerms"
                      value={editForm.discountTerms}
                      onChange={(e) =>
                        updateField("discountTerms", e.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-deliveryLeadTimeDays">
                      Lead Time (days)
                    </Label>
                    <Input
                      id="edit-deliveryLeadTimeDays"
                      type="number"
                      value={editForm.deliveryLeadTimeDays}
                      onChange={(e) =>
                        updateField("deliveryLeadTimeDays", e.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-rating">Rating (0-5)</Label>
                  <Input
                    id="edit-rating"
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={editForm.rating}
                    onChange={(e) => updateField("rating", e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </RequirePerm>
    </AppShell>
  );
}
