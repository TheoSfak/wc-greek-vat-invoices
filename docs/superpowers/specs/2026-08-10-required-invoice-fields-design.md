# Per-Field Required/Optional Settings for Invoice Fields

Date: 2026-08-10
Status: Approved
Target release: 1.2.0

## Problem

The plugin collects four fields when a customer selects "Τιμολόγιο" (invoice) at
checkout: Επωνυμία Επιχείρησης (company name), ΑΦΜ (VAT number), ΔΟΥ (tax
office), and Επάγγελμα (business activity). All four are currently hardcoded
as mandatory once "Τιμολόγιο" is selected, enforced in PHP validation on both
checkout types. But on Block Checkout, only ΑΦΜ is registered with
`required => true`; the other three are registered `required => false`. Woo
Blocks uses that flag to decide whether to show a "(Optional)" label — so the
UI tells customers company/ΔΟΥ/activity are optional while the server
actually rejects the order if they're empty. Reported by the store owner
directly: "Βλέπω ότι το ΑΦΜ είναι υποχρεωτικό, ενώ τα πεδία Επωνυμία
Επιχείρησης, ΔΟΥ και Επάγγελμα εμφανίζονται ως προαιρετικά."

Root cause: `includes/class-block-checkout.php`, `register_fields()`, lines
97-149 — hardcoded `required` values that don't reflect actual validation
behavior.

## Goals

- Let the store admin decide, per field, whether each of the 4 invoice
  fields is required or optional when "Τιμολόγιο" is selected.
- Default: all 4 required (matches current behavior, safe for existing
  installs with no migration needed).
- One setting per field, shared by both Classic and Block checkout — no
  per-checkout-type divergence.
- ΑΦΜ format (exactly 9 digits) is validated whenever a value is present,
  regardless of the required/optional setting.
- UI labels (Classic and Block) accurately reflect the real required state.

## Non-goals

- Not changing which fields exist or adding new fields.
- Not changing VAT number *format* validation logic itself, only when the
  "must not be empty" check applies.
- Not touching AADE/VIES lookup, Article 39a exemption logic, or invoice
  numbering — unrelated systems.
- No database migration — new options rely on `get_option()`'s default
  parameter, so existing installs behave identically to fresh installs.

## Design

### New settings

Four checkboxes, new section "Υποχρεωτικά Πεδία Τιμολογίου" in
`GRVATIN_Admin_Settings::get_settings()`, placed after "Ενεργοποίηση
Επιλογής Παραστατικού":

| Option ID | Label | Default |
|---|---|---|
| `GRVATIN_require_company` | Επωνυμία Επιχείρησης υποχρεωτική | yes |
| `GRVATIN_require_vat` | ΑΦΜ υποχρεωτικό | yes |
| `GRVATIN_require_doy` | ΔΟΥ υποχρεωτική | yes |
| `GRVATIN_require_activity` | Επάγγελμα υποχρεωτικό | yes |

Standard WooCommerce Settings API checkboxes — same pattern already used for
`GRVATIN_enable_selection` and the uppercase toggle. No custom rendering or
save handling required.

### Classic Checkout (`includes/class-checkout-fields.php`)

- `validate_invoice_fields()`: each of the four `empty($_POST[...])`
  required-checks is gated behind its setting, e.g.:
  ```php
  if (get_option('GRVATIN_require_company', 'yes') === 'yes' && empty($_POST['billing_company'])) {
      $errors->add('billing_company', __('Η επωνυμία είναι υποχρεωτική για την έκδοση τιμολογίου.', ...));
  }
  ```
  The ΑΦΜ format check (`preg_match('/^[0-9]{9}$/', ...)`) stays unconditional
  whenever `billing_vat_number` is non-empty, independent of the required
  setting.
- `remove_optional_text()`: currently strips "(προαιρετικό)"/"(optional)"
  from all 4 fields unconditionally. Changes to only strip it for fields
  that are currently required per settings; optional fields keep the
  native WooCommerce optional-label suffix.

### Classic Checkout JS (`assets/js/checkout.js`)

- `toggleInvoiceFields()` currently does a blanket
  `$invoiceFields.find('input').prop('required', true)` for all 4 fields
  when "Τιμολόγιο" is selected. Becomes per-field, driven by the same 4
  settings, so native browser required-validation only applies to fields
  actually marked required.
- The 4 setting values are passed to JS via the existing
  `wp_localize_script('wcgvi-checkout', 'grvatin_params', ...)` call in the
  main plugin file (new keys: `require_company`, `require_vat`,
  `require_doy`, `require_activity`) — same mechanism already used for
  `uppercase`.

### Block Checkout (`includes/class-block-checkout.php`)

- `register_fields()`: the four hardcoded `required` values become
  setting-driven, e.g.
  `'required' => get_option('GRVATIN_require_company', 'yes') === 'yes'`.
  This is the direct fix for the reported issue — Block Checkout's
  "(Optional)" label will only appear on fields genuinely marked optional.
- `validate_vat_number()` and `validate_invoice_required_field()`: each
  gated behind its setting the same way as classic — a field marked
  optional won't block Store API submission even when invoice type is
  selected. ΑΦΜ format check remains unconditional whenever a value is
  present.
- No changes needed to `assets/js/block-checkout.js` — it only toggles
  field *visibility* by invoice type, unaffected by required/optional.

### Bundled fixes (same release, unrelated root cause but touching the
same files)

1. **Uppercase setting bug**: `GRVATIN_Admin_Settings::get_settings()` has
   `'id' => 'GRVATIN_uppercase'` for the "Μετατροπή σε Κεφαλαία" checkbox,
   but every consumer (`checkout.js` params, block checkout sanitizer,
   checkout-fields save methods, activation defaults) reads
   `GRVATIN_uppercase_fields`. Fix: change the settings array id to
   `GRVATIN_uppercase_fields` so the checkbox actually controls the
   behavior it claims to.
2. **Donate link update**: replace
   `https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com`
   with `https://paypal.me/TheodoreSfakianakis` in all 9 occurrences across
   `greek-vat-invoices-for-woocommerce.php` (Author URI header),
   `includes/class-admin-settings.php` (donate button), `readme.txt` (×3),
   `README.md` (×3), `languages/README.md` (×1).

### Versioning

Ships as **1.2.0** (new feature, not a patch):
- `greek-vat-invoices-for-woocommerce.php`: `Version:` header +
  `GRVATIN_VERSION` constant → 1.2.0
- `readme.txt`: `Stable tag: 1.2.0` + new changelog entry covering the
  required-fields feature, the uppercase-setting fix, and the donate link
  update
- `WHATSNEW.txt`: new 1.2.0 entry

## Testing plan

Local WordPress + WooCommerce is already running at
`C:\xampp\htdocs\wordpress` (Apache/MySQL active, plugin already installed
there at 1.1.0). Before any commit to GitHub or WordPress.org SVN:

1. Copy the updated plugin files into the XAMPP plugins folder.
2. For each of Classic and Block checkout:
   - Confirm all 4 fields show as required by default (no settings changed).
   - Toggle each of the 4 settings off one at a time; confirm the
     corresponding field (a) shows/keeps the "(προαιρετικό)"/"(Optional)"
     label, (b) does not block order submission when left empty, (c) does
     not carry stale required-state from a previous toggle.
   - With ΑΦΜ optional and a partial/invalid value entered (e.g. "123"),
     confirm the 9-digit format error still fires.
   - With ΑΦΜ optional and left empty, confirm the order submits.
   - Select "Απόδειξη" (receipt) and confirm none of the 4 fields are
     required regardless of settings (unchanged existing behavior).
3. Confirm the uppercase checkbox, once toggled, now actually changes
   whether typed values are upper-cased.
4. Confirm the donate link footer button and readme links point to the
   new paypal.me URL.

## Rollout workflow

1. Implement and test in the git working copy
   (`C:\Users\user\Desktop\greek-vat-invoices-git`).
2. Verify locally against `C:\xampp\htdocs\wordpress` per the testing plan
   above.
3. `git commit` + push to `TheoSfak/greek-vat-invoices-for-woo` on GitHub.
4. Mirror the changed files into `C:\Users\user\Desktop\svn-greek-vat\trunk`.
5. `svn commit` to publish to the WordPress.org plugin repository.
6. `svn cp trunk tags/1.2.0` (+ commit) to cut the release tag.
