"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { createApplicationAction } from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, Select, Textarea } from "@/components/ui/input";
import { INCOME_SOURCES, PURPOSES } from "@/lib/constants";

const DISTRICTS: Array<[string, string]> = [
  ["Bengaluru Urban", "ಬೆಂಗಳೂರು ನಗರ"],
  ["Ramanagara", "ರಾಮನಗರ"],
  ["Mandya", "ಮಂಡ್ಯ"],
  ["Mysuru", "ಮೈಸೂರು"],
  ["Tumakuru", "ತುಮಕೂರು"],
  ["Kolar", "ಕೋಲಾರ"],
];

export function NewApplicationForm({
  officers,
}: {
  officers: { id: string; name: string; nameKn: string | null; taluk: string | null }[];
}) {
  const { lang, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    fullName: "",
    fullNameKn: "",
    fatherName: "",
    phone: "",
    addressLine1: "",
    village: "",
    taluk: "",
    district: "Ramanagara",
    pincode: "",
    declaredAnnualIncome: "",
    incomeSource: "AGRICULTURE",
    purpose: "SCHOLARSHIP",
    purposeDetails: "",
    assignedOfficerId: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (form.fullName.trim().length < 2) e.fullName = t.form.fieldRequired;
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = t.form.invalidPhone;
    if (form.addressLine1.trim().length < 3) e.addressLine1 = t.form.fieldRequired;
    if (form.village.trim().length < 2) e.village = t.form.fieldRequired;
    if (form.taluk.trim().length < 2) e.taluk = t.form.fieldRequired;
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = t.form.invalidPincode;
    const income = parseInt(form.declaredAnnualIncome, 10);
    if (!Number.isFinite(income) || income < 0) e.declaredAnnualIncome = t.form.invalidIncome;
    return e;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    setErrors(v);
    if (Object.keys(v).length) return;
    startTransition(async () => {
      const res = await createApplicationAction({
        applicant: {
          fullName: form.fullName.trim(),
          fullNameKn: form.fullNameKn.trim() || undefined,
          fatherName: form.fatherName.trim() || undefined,
          phone: form.phone,
          addressLine1: form.addressLine1.trim(),
          village: form.village.trim(),
          taluk: form.taluk.trim(),
          district: form.district,
          districtKn: DISTRICTS.find((d) => d[0] === form.district)?.[1],
          pincode: form.pincode,
        },
        declaredAnnualIncome: parseInt(form.declaredAnnualIncome, 10),
        incomeSource: form.incomeSource,
        purpose: form.purpose,
        purposeDetails: form.purposeDetails.trim() || undefined,
        assignedOfficerId: form.assignedOfficerId || undefined,
      });
      if (res.ok) {
        toast.success(`${t.form.createSuccess} — ${res.data!.referenceNumber}`);
        router.push(`/applications/${res.data!.id}`);
      } else {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        else toast.error(res.error);
      }
    });
  };

  const err = (k: string) => errors[k] ?? errors[`applicant.${k}`];

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Applicant */}
      <div className="card p-5">
        <p className="mb-4 text-sm font-semibold text-ink">{t.applications.applicantDetails}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label required htmlFor="f-fullName">{t.form.fullName}</Label>
            <Input id="f-fullName" value={form.fullName} onChange={set("fullName")} />
            <FieldError>{err("fullName")}</FieldError>
          </div>
          <div>
            <Label htmlFor="f-fullNameKn">{t.form.fullNameKn}</Label>
            <Input id="f-fullNameKn" value={form.fullNameKn} onChange={set("fullNameKn")} className="lang-kn" />
          </div>
          <div>
            <Label htmlFor="f-fatherName">{t.form.fatherName}</Label>
            <Input id="f-fatherName" value={form.fatherName} onChange={set("fatherName")} />
          </div>
          <div>
            <Label required htmlFor="f-phone">{t.form.phone}</Label>
            <Input id="f-phone" value={form.phone} onChange={set("phone")} inputMode="numeric" maxLength={10} placeholder="98XXXXXXXX" />
            <FieldError>{err("phone")}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label required htmlFor="f-addressLine1">{t.form.addressLine1}</Label>
            <Input id="f-addressLine1" value={form.addressLine1} onChange={set("addressLine1")} />
            <FieldError>{err("addressLine1")}</FieldError>
          </div>
          <div>
            <Label required htmlFor="f-village">{t.form.village}</Label>
            <Input id="f-village" value={form.village} onChange={set("village")} />
            <FieldError>{err("village")}</FieldError>
          </div>
          <div>
            <Label required htmlFor="f-taluk">{t.form.taluk}</Label>
            <Input id="f-taluk" value={form.taluk} onChange={set("taluk")} />
            <FieldError>{err("taluk")}</FieldError>
          </div>
          <div>
            <Label required htmlFor="f-district">{t.form.district}</Label>
            <Select id="f-district" value={form.district} onChange={set("district")}>
              {DISTRICTS.map(([en, kn]) => (
                <option key={en} value={en}>{lang === "kn" ? `${kn} (${en})` : en}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label required htmlFor="f-pincode">{t.form.pincode}</Label>
            <Input id="f-pincode" value={form.pincode} onChange={set("pincode")} inputMode="numeric" maxLength={6} placeholder="562XXX" />
            <FieldError>{err("pincode")}</FieldError>
          </div>
        </div>
      </div>

      {/* Application */}
      <div className="card p-5">
        <p className="mb-4 text-sm font-semibold text-ink">{t.applications.applicationDetails}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label required htmlFor="f-income">{t.form.declaredAnnualIncome}</Label>
            <Input
              id="f-income"
              type="number"
              min={0}
              value={form.declaredAnnualIncome}
              onChange={set("declaredAnnualIncome")}
              placeholder="120000"
            />
            <FieldError>{err("declaredAnnualIncome")}</FieldError>
          </div>
          <div>
            <Label required htmlFor="f-incomeSource">{t.form.incomeSource}</Label>
            <Select id="f-incomeSource" value={form.incomeSource} onChange={set("incomeSource")}>
              {Object.keys(INCOME_SOURCES).map((k) => (
                <option key={k} value={k}>{t.incomeSource[k as keyof typeof t.incomeSource]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label required htmlFor="f-purpose">{t.form.purpose}</Label>
            <Select id="f-purpose" value={form.purpose} onChange={set("purpose")}>
              {Object.keys(PURPOSES).map((k) => (
                <option key={k} value={k}>{t.purpose[k as keyof typeof t.purpose]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="f-assignTo">{t.form.assignTo}</Label>
            <Select id="f-assignTo" value={form.assignedOfficerId} onChange={set("assignedOfficerId")}>
              <option value="">—</option>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {lang === "kn" && o.nameKn ? o.nameKn : o.name}{o.taluk ? ` (${o.taluk})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>{t.form.purposeDetails}</Label>
            <Textarea value={form.purposeDetails} onChange={set("purposeDetails")} rows={2} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full sm:w-auto">
          <Save className="h-4 w-4" />
          {pending ? t.form.creating : t.form.createApplication}
        </Button>
      </div>
    </form>
  );
}
