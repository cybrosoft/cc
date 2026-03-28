# Schema Patch — Address Field Additions

Add the following 4 fields to BOTH `User` and `PendingSignup` models.

### In `User` model — after `city String?` line:

```prisma
  buildingNumber  String?   // Saudi only — WASL/National Address building number
  secondaryNumber String?   // Saudi only — WASL/National Address secondary number
  postalCode      String?   // all markets — postal/zip code
  shortAddressCode String?  // business info — Saudi National Address short code e.g. RNAD2323
```

### In `PendingSignup` model — after `city String?` line:

```prisma
  buildingNumber  String?
  secondaryNumber String?
  postalCode      String?
  shortAddressCode String?
```

Then run: `npx prisma migrate dev --name add_address_fields`
