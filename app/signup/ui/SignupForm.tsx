// FILE: app/signup/ui/SignupForm.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type MarketOption = { id: string; name: string; key: string };

type SignupOk = { ok: true; userExists: boolean };
type SignupErr = { ok: false; error: string };
type SignupResp = SignupOk | SignupErr;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const SAUDI_PROVINCES = [
  "Riyadh Province",
  "Makkah al-Mukarramah Province",
  "Al-Madinah Al-Munawwarah Province",
  "Eastern Province (Ash Sharqiyah)",
  "Aseer Province",
  "Tabuk Province",
  "Hail Province",
  "al-Qassim Province",
  "Jazan Province",
  "Najran Province",
  "Al-Bahah Province",
  "Al-Jawf Province",
] as const;

type CountryOption = { code: string; label: string };

// ISO 3166-1 alpha-2 country list (common names)
const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "AF", label: "Afghanistan" },
  { code: "AX", label: "Åland Islands" },
  { code: "AL", label: "Albania" },
  { code: "DZ", label: "Algeria" },
  { code: "AS", label: "American Samoa" },
  { code: "AD", label: "Andorra" },
  { code: "AO", label: "Angola" },
  { code: "AI", label: "Anguilla" },
  { code: "AQ", label: "Antarctica" },
  { code: "AG", label: "Antigua and Barbuda" },
  { code: "AR", label: "Argentina" },
  { code: "AM", label: "Armenia" },
  { code: "AW", label: "Aruba" },
  { code: "AU", label: "Australia" },
  { code: "AT", label: "Austria" },
  { code: "AZ", label: "Azerbaijan" },
  { code: "BS", label: "Bahamas" },
  { code: "BH", label: "Bahrain" },
  { code: "BD", label: "Bangladesh" },
  { code: "BB", label: "Barbados" },
  { code: "BE", label: "Belgium" },
  { code: "BZ", label: "Belize" },
  { code: "BJ", label: "Benin" },
  { code: "BM", label: "Bermuda" },
  { code: "BT", label: "Bhutan" },
  { code: "BO", label: "Bolivia" },
  { code: "BQ", label: "Bonaire, Sint Eustatius and Saba" },
  { code: "BA", label: "Bosnia and Herzegovina" },
  { code: "BW", label: "Botswana" },
  { code: "BV", label: "Bouvet Island" },
  { code: "BR", label: "Brazil" },
  { code: "IO", label: "British Indian Ocean Territory" },
  { code: "BN", label: "Brunei Darussalam" },
  { code: "BG", label: "Bulgaria" },
  { code: "BF", label: "Burkina Faso" },
  { code: "BI", label: "Burundi" },
  { code: "KH", label: "Cambodia" },
  { code: "CM", label: "Cameroon" },
  { code: "CA", label: "Canada" },
  { code: "CV", label: "Cape Verde" },
  { code: "KY", label: "Cayman Islands" },
  { code: "CF", label: "Central African Republic" },
  { code: "TD", label: "Chad" },
  { code: "CL", label: "Chile" },
  { code: "CN", label: "China" },
  { code: "CX", label: "Christmas Island" },
  { code: "CC", label: "Cocos (Keeling) Islands" },
  { code: "CO", label: "Colombia" },
  { code: "KM", label: "Comoros" },
  { code: "CG", label: "Congo" },
  { code: "CD", label: "Congo (Democratic Republic)" },
  { code: "CK", label: "Cook Islands" },
  { code: "CR", label: "Costa Rica" },
  { code: "CI", label: "Côte d’Ivoire" },
  { code: "HR", label: "Croatia" },
  { code: "CW", label: "Curaçao" },
  { code: "CY", label: "Cyprus" },
  { code: "CZ", label: "Czechia" },
  { code: "DK", label: "Denmark" },
  { code: "DJ", label: "Djibouti" },
  { code: "DM", label: "Dominica" },
  { code: "DO", label: "Dominican Republic" },
  { code: "EC", label: "Ecuador" },
  { code: "EG", label: "Egypt" },
  { code: "SV", label: "El Salvador" },
  { code: "GQ", label: "Equatorial Guinea" },
  { code: "ER", label: "Eritrea" },
  { code: "EE", label: "Estonia" },
  { code: "SZ", label: "Eswatini" },
  { code: "ET", label: "Ethiopia" },
  { code: "FK", label: "Falkland Islands" },
  { code: "FO", label: "Faroe Islands" },
  { code: "FJ", label: "Fiji" },
  { code: "FI", label: "Finland" },
  { code: "FR", label: "France" },
  { code: "GF", label: "French Guiana" },
  { code: "PF", label: "French Polynesia" },
  { code: "TF", label: "French Southern Territories" },
  { code: "GA", label: "Gabon" },
  { code: "GM", label: "Gambia" },
  { code: "GE", label: "Georgia" },
  { code: "DE", label: "Germany" },
  { code: "GH", label: "Ghana" },
  { code: "GI", label: "Gibraltar" },
  { code: "GR", label: "Greece" },
  { code: "GL", label: "Greenland" },
  { code: "GD", label: "Grenada" },
  { code: "GP", label: "Guadeloupe" },
  { code: "GU", label: "Guam" },
  { code: "GT", label: "Guatemala" },
  { code: "GG", label: "Guernsey" },
  { code: "GN", label: "Guinea" },
  { code: "GW", label: "Guinea-Bissau" },
  { code: "GY", label: "Guyana" },
  { code: "HT", label: "Haiti" },
  { code: "HM", label: "Heard Island and McDonald Islands" },
  { code: "VA", label: "Holy See (Vatican City State)" },
  { code: "HN", label: "Honduras" },
  { code: "HK", label: "Hong Kong" },
  { code: "HU", label: "Hungary" },
  { code: "IS", label: "Iceland" },
  { code: "IN", label: "India" },
  { code: "ID", label: "Indonesia" },
  { code: "IQ", label: "Iraq" },
  { code: "IE", label: "Ireland" },
  { code: "IM", label: "Isle of Man" },
  { code: "IL", label: "Israel" },
  { code: "IT", label: "Italy" },
  { code: "JM", label: "Jamaica" },
  { code: "JP", label: "Japan" },
  { code: "JE", label: "Jersey" },
  { code: "JO", label: "Jordan" },
  { code: "KZ", label: "Kazakhstan" },
  { code: "KE", label: "Kenya" },
  { code: "KI", label: "Kiribati" },
  { code: "KR", label: "Korea (South)" },
  { code: "KW", label: "Kuwait" },
  { code: "KG", label: "Kyrgyzstan" },
  { code: "LA", label: "Lao People’s Democratic Republic" },
  { code: "LV", label: "Latvia" },
  { code: "LB", label: "Lebanon" },
  { code: "LS", label: "Lesotho" },
  { code: "LR", label: "Liberia" },
  { code: "LY", label: "Libya" },
  { code: "LI", label: "Liechtenstein" },
  { code: "LT", label: "Lithuania" },
  { code: "LU", label: "Luxembourg" },
  { code: "MO", label: "Macao" },
  { code: "MG", label: "Madagascar" },
  { code: "MW", label: "Malawi" },
  { code: "MY", label: "Malaysia" },
  { code: "MV", label: "Maldives" },
  { code: "ML", label: "Mali" },
  { code: "MT", label: "Malta" },
  { code: "MH", label: "Marshall Islands" },
  { code: "MQ", label: "Martinique" },
  { code: "MR", label: "Mauritania" },
  { code: "MU", label: "Mauritius" },
  { code: "YT", label: "Mayotte" },
  { code: "MX", label: "Mexico" },
  { code: "FM", label: "Micronesia" },
  { code: "MD", label: "Moldova" },
  { code: "MC", label: "Monaco" },
  { code: "MN", label: "Mongolia" },
  { code: "ME", label: "Montenegro" },
  { code: "MS", label: "Montserrat" },
  { code: "MA", label: "Morocco" },
  { code: "MZ", label: "Mozambique" },
  { code: "MM", label: "Myanmar" },
  { code: "NA", label: "Namibia" },
  { code: "NR", label: "Nauru" },
  { code: "NP", label: "Nepal" },
  { code: "NL", label: "Netherlands" },
  { code: "NC", label: "New Caledonia" },
  { code: "NZ", label: "New Zealand" },
  { code: "NI", label: "Nicaragua" },
  { code: "NE", label: "Niger" },
  { code: "NG", label: "Nigeria" },
  { code: "NU", label: "Niue" },
  { code: "NF", label: "Norfolk Island" },
  { code: "MK", label: "North Macedonia" },
  { code: "MP", label: "Northern Mariana Islands" },
  { code: "NO", label: "Norway" },
  { code: "OM", label: "Oman" },
  { code: "PK", label: "Pakistan" },
  { code: "PW", label: "Palau" },
  { code: "PS", label: "Palestine, State of" },
  { code: "PA", label: "Panama" },
  { code: "PG", label: "Papua New Guinea" },
  { code: "PY", label: "Paraguay" },
  { code: "PE", label: "Peru" },
  { code: "PH", label: "Philippines" },
  { code: "PN", label: "Pitcairn" },
  { code: "PL", label: "Poland" },
  { code: "PT", label: "Portugal" },
  { code: "PR", label: "Puerto Rico" },
  { code: "QA", label: "Qatar" },
  { code: "RE", label: "Réunion" },
  { code: "RO", label: "Romania" },
  { code: "RW", label: "Rwanda" },
  { code: "BL", label: "Saint Barthélemy" },
  { code: "SH", label: "Saint Helena, Ascension and Tristan da Cunha" },
  { code: "KN", label: "Saint Kitts and Nevis" },
  { code: "LC", label: "Saint Lucia" },
  { code: "MF", label: "Saint Martin (French part)" },
  { code: "PM", label: "Saint Pierre and Miquelon" },
  { code: "VC", label: "Saint Vincent and the Grenadines" },
  { code: "WS", label: "Samoa" },
  { code: "SM", label: "San Marino" },
  { code: "ST", label: "Sao Tome and Principe" },
  { code: "SA", label: "Saudi Arabia" },
  { code: "SN", label: "Senegal" },
  { code: "RS", label: "Serbia" },
  { code: "SC", label: "Seychelles" },
  { code: "SL", label: "Sierra Leone" },
  { code: "SG", label: "Singapore" },
  { code: "SX", label: "Sint Maarten (Dutch part)" },
  { code: "SK", label: "Slovakia" },
  { code: "SI", label: "Slovenia" },
  { code: "SB", label: "Solomon Islands" },
  { code: "SO", label: "Somalia" },
  { code: "ZA", label: "South Africa" },
  { code: "GS", label: "South Georgia and the South Sandwich Islands" },
  { code: "SS", label: "South Sudan" },
  { code: "ES", label: "Spain" },
  { code: "LK", label: "Sri Lanka" },
  { code: "SD", label: "Sudan" },
  { code: "SR", label: "Suriname" },
  { code: "SJ", label: "Svalbard and Jan Mayen" },
  { code: "SE", label: "Sweden" },
  { code: "CH", label: "Switzerland" },
  { code: "TW", label: "Taiwan" },
  { code: "TJ", label: "Tajikistan" },
  { code: "TZ", label: "Tanzania" },
  { code: "TH", label: "Thailand" },
  { code: "TL", label: "Timor-Leste" },
  { code: "TG", label: "Togo" },
  { code: "TK", label: "Tokelau" },
  { code: "TO", label: "Tonga" },
  { code: "TT", label: "Trinidad and Tobago" },
  { code: "TN", label: "Tunisia" },
  { code: "TR", label: "Türkiye" },
  { code: "TM", label: "Turkmenistan" },
  { code: "TC", label: "Turks and Caicos Islands" },
  { code: "TV", label: "Tuvalu" },
  { code: "UG", label: "Uganda" },
  { code: "UA", label: "Ukraine" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "GB", label: "United Kingdom" },
  { code: "US", label: "United States" },
  { code: "UM", label: "United States Minor Outlying Islands" },
  { code: "UY", label: "Uruguay" },
  { code: "UZ", label: "Uzbekistan" },
  { code: "VU", label: "Vanuatu" },
  { code: "VE", label: "Venezuela" },
  { code: "VN", label: "Viet Nam" },
  { code: "VG", label: "Virgin Islands (British)" },
  { code: "VI", label: "Virgin Islands (U.S.)" },
  { code: "WF", label: "Wallis and Futuna" },
  { code: "EH", label: "Western Sahara" },
  { code: "YE", label: "Yemen" },
  { code: "ZM", label: "Zambia" },
  { code: "ZW", label: "Zimbabwe" },
];

// UI-only exclusion
const SANCTIONED_COUNTRY_CODES = ["CU", "IR", "KP", "SY", "RU", "BY"] as const;

function isSanctionedCountry(code: string): boolean {
  return (SANCTIONED_COUNTRY_CODES as readonly string[]).includes(code);
}

type AccountType = "BUSINESS" | "PERSONAL";

export default function SignupForm({ markets }: { markets: MarketOption[] }) {
  const router = useRouter();

  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [mobile, setMobile] = useState<string>("");

  const [marketId, setMarketId] = useState<string>(markets[0]?.id ?? "");
  const [country, setCountry] = useState<string>("SA");

  // ✅ Default selected: BUSINESS
  const [accountType, setAccountType] = useState<AccountType>("BUSINESS");
  const isBusiness = accountType === "BUSINESS";

  const [province, setProvince] = useState<string>(SAUDI_PROVINCES[0] ?? "");
  const [provinceStateText, setProvinceStateText] = useState<string>("");

  const [companyName, setCompanyName] = useState<string>("");
  const [vatTaxId, setVatTaxId] = useState<string>("");
  const [commercialRegistrationNumber, setCommercialRegistrationNumber] = useState<string>("");

  const [addressLine1, setAddressLine1] = useState<string>("");
  const [addressLine2, setAddressLine2] = useState<string>("");
  const [district, setDistrict] = useState<string>("");
  const [city, setCity] = useState<string>("");

  const [legalAccepted, setLegalAccepted] = useState<boolean>(false);
  const [marketingAccepted, setMarketingAccepted] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [existingEmail, setExistingEmail] = useState<string | null>(null);

  const isSaudi = country === "SA";

  const provinceOptions = useMemo(() => SAUDI_PROVINCES.map((p) => ({ value: p, label: p })), []);

  const allowedCountries = useMemo(() => COUNTRY_OPTIONS.filter((c) => !isSanctionedCountry(c.code)), []);

  async function postJson(url: string, body: unknown): Promise<Response> {
    return fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function requireTrimmed(label: string, v: string): string | null {
    if (!v.trim()) return `${label} is required.`;
    return null;
  }

  function safeLoginHref(emailNorm: string): string {
    return `/login?email=${encodeURIComponent(emailNorm)}`;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setExistingEmail(null);

    const emailNorm = normalizeEmail(email);

    const err1 = requireTrimmed("Full name", fullName);
    if (err1) return setError(err1);

    const err2 = requireTrimmed("Email", emailNorm);
    if (err2) return setError(err2);

    const err3 = requireTrimmed("Mobile", mobile);
    if (err3) return setError(err3);

    if (!marketId) return setError("Market is required.");
    if (!country) return setError("Country is required.");
    if (isSanctionedCountry(country)) return setError("This country is not supported.");

    if (isSaudi && !province.trim()) return setError("Province is required for Saudi Arabia.");

    if (!legalAccepted) return setError("You must accept the Terms & Conditions and Privacy Policy.");

    const provinceToSend = isSaudi ? province : provinceStateText.trim() || null;

    const companyToSend = isBusiness ? companyName.trim() || null : null;
    const vatToSend = isBusiness ? vatTaxId.trim() || null : null;
    const crToSend = isBusiness ? commercialRegistrationNumber.trim() || null : null;

    setLoading(true);
    try {
      const res = await postJson("/api/auth/signup", {
        email: emailNorm,
        marketId,

        fullName: fullName.trim(),
        mobile: mobile.trim(),

        companyName: companyToSend,
        vatTaxId: vatToSend,
        commercialRegistrationNumber: crToSend,

        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        district: district.trim() || null,
        city: city.trim() || null,

        country,
        province: provinceToSend,

        tcAccepted: true,
        privacyAccepted: true,

        marketingAccepted,
      });

      // ✅ Fix "Unexpected server response" by safely handling non-JSON
      const data = (await res.json().catch(() => null)) as SignupResp | null;

      if (!data) {
        // If server returned non-JSON but status OK, proceed to login
        if (res.ok) {
          router.push(safeLoginHref(emailNorm));
          return;
        }
        setError("Server error.");
        return;
      }

      if (data.ok === false) {
        setError(data.error);
        return;
      }

      if (data.userExists) {
        setExistingEmail(emailNorm);
        return;
      }

      router.push(safeLoginHref(emailNorm));
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Full name *</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Email *</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          inputMode="email"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="text-sm font-medium">Mobile number *</label>
        <input
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="+9665XXXXXXXX"
          inputMode="tel"
          autoComplete="tel"
        />
      </div>

      <div>
        <div className="text-sm font-medium">Account type *</div>
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="accountType"
              value="BUSINESS"
              checked={accountType === "BUSINESS"}
              onChange={() => setAccountType("BUSINESS")}
            />
            Business
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="accountType"
              value="PERSONAL"
              checked={accountType === "PERSONAL"}
              onChange={() => setAccountType("PERSONAL")}
            />
            Personal
          </label>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Market *</label>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
        >
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.key})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Country *</label>
        <select
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          value={country}
          onChange={(e) => {
            const next = e.target.value;
            setCountry(next);

            if (next === "SA") {
              setProvince(SAUDI_PROVINCES[0] ?? "");
              setProvinceStateText("");
            } else {
              setProvince("");
            }
          }}
        >
          {allowedCountries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {isSaudi ? (
        <div>
          <label className="text-sm font-medium">Province (Saudi) *</label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            {provinceOptions.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium">Province / State</label>
          <textarea
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={provinceStateText}
            onChange={(e) => setProvinceStateText(e.target.value)}
            placeholder="Type your province/state (optional)"
            rows={2}
          />
        </div>
      )}

      <div className="rounded-md border p-3">
        <div className="text-sm font-medium">Optional details</div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {isBusiness ? (
            <>
              <div>
                <label className="text-sm font-medium">Company name</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Company"
                  autoComplete="organization"
                />
              </div>

              <div>
                <label className="text-sm font-medium">VAT / Tax ID</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={vatTaxId}
                  onChange={(e) => setVatTaxId(e.target.value)}
                  placeholder="Tax ID"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Commercial registration number</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={commercialRegistrationNumber}
                  onChange={(e) => setCommercialRegistrationNumber(e.target.value)}
                  placeholder="CR number"
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="text-sm font-medium">City</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              autoComplete="address-level2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Address line 1</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="Street, building, etc."
              autoComplete="address-line1"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium">Address line 2</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="Apartment, suite, etc."
              autoComplete="address-line2"
            />
          </div>

          <div>
            <label className="text-sm font-medium">District / County</label>
            <input
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="District"
              autoComplete="address-level3"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} />
          <span>
            I accept the <span className="font-medium">Terms &amp; Conditions</span> and{" "}
            <span className="font-medium">Privacy Policy</span> *
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={marketingAccepted} onChange={(e) => setMarketingAccepted(e.target.checked)} />
          <span>I agree to receive marketing updates (optional)</span>
        </label>
      </div>

      {/* ✅ Existing account message + login link */}
      {existingEmail ? (
        <div className="rounded-md border p-3 text-sm">
          An account with this email already exists.{" "}
          <a className="underline" href={safeLoginHref(existingEmail)}>
            Go to login
          </a>
          .
        </div>
      ) : null}

      {error ? <div className="rounded-md border p-3 text-sm">{error}</div> : null}

      <button type="submit" disabled={loading} className="w-full rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-60">
        {loading ? "Sending code..." : "Continue"}
      </button>
    </form>
  );
}