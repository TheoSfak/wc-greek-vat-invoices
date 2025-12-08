# Οδηγίες Ρύθμισης AADE API

## Πώς να πάρετε Username/Password για το AADE API

Για να χρησιμοποιήσετε το πλήρες AADE validation API, πρέπει να έχετε:

### 1. Εγγραφή στο myAADE
1. Πηγαίνετε στο https://www1.aade.gr/gsisapps/tfprovider/faces/pages/tfproviderlogin.xhtml
2. Συνδεθείτε με τους κωδικούς Taxisnet της εταιρείας σας
3. Μεταβείτε στην ενότητα **"Παροχή Διαδικτυακών Υπηρεσιών"**

### 2. Λήψη API Credentials
1. Επιλέξτε **"Διαχείριση Εξουσιοδοτήσεων"**
2. Δημιουργήστε νέο χρήστη για το **RgWsPublic2** service
3. Θα λάβετε:
   - **Username**: Το όνομα χρήστη που δημιουργήσατε
   - **Password**: Ο κωδικός πρόσβασης

### 3. Ρύθμιση στο Plugin
1. Πηγαίνετε στο **WooCommerce > Ρυθμίσεις > Greek VAT & Invoices**
2. Στην ενότητα **"AADE API"**, συμπληρώστε:
   - **AADE Username**: Το username σας
   - **AADE Password**: Τον κωδικό σας
3. Πατήστε **"Δοκιμή Σύνδεσης AADE"** για έλεγχο

## Endpoints

### Production (Παραγωγή)
```
https://www1.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2
```

### Test (Δοκιμές)
```
https://test.gsis.gr/wsaade/RgWsPublic2/RgWsPublic2
```

## Troubleshooting

### Σφάλμα: "Δεν έχουν οριστεί τα διαπιστευτήρια AADE"
- Βεβαιωθείτε ότι έχετε συμπληρώσει το Username και Password στις ρυθμίσεις

### Σφάλμα: "HTTP 401 - Unauthorized"
- Τα credentials είναι λάθος
- Ελέγξτε ότι έχετε δημιουργήσει τον χρήστη σωστά στο myAADE

### Σφάλμα: "HTTP 500 - Internal Server Error"
- Πρόβλημα στο AADE API
- Δοκιμάστε ξανά αργότερα

### Κενή απάντηση
- Το AADE API μπορεί να είναι προσωρινά κάτω
- Το plugin θα κάνει αυτόματα fallback σε format validation

## Fallback Mechanism

Το plugin έχει **graceful degradation**:
1. **AADE API** (πλήρης επικύρωση με στοιχεία εταιρείας) ✅
2. **VIES API** (για intra-EU companies) ✅
3. **Format Check** (9 ψηφία) ✅

Αν το AADE API δεν είναι διαθέσιμο, θα χρησιμοποιηθεί format validation.

## Χρήσιμοι Σύνδεσμοι

- **myAADE Portal**: https://www1.aade.gr/gsisapps/tfprovider/
- **AADE Τεχνική Τεκμηρίωση**: https://www.aade.gr/epicheiriseis/forologikes-ypiresies/mitroo
- **AADE Support**: 210-3375555

## Σημειώσεις

- Τα credentials είναι **ανά εταιρεία**
- Χρειάζεται **Taxisnet login** για δημιουργία
- Το API είναι **δωρεάν** για όλες τις εταιρείες
- Υποστηρίζει **SOAP protocol** με WS-Security

---

**Author**: Theodore Sfakianakis  
**Donate**: https://www.paypal.com/paypalme/TheodoreSfakianakis
