# Per-Field Required/Optional Invoice Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the store admin mark each of the 4 invoice fields (Company, ΑΦΜ, ΔΟΥ, Business Activity) as required or optional independently, defaulting to all 4 required, consistently across Classic and Block checkout — fixing the Block Checkout bug where only ΑΦΜ showed as required while the other 3 showed "(Optional)" despite the server rejecting them empty.

**Architecture:** Four new `GRVATIN_require_*` WooCommerce options (default `'yes'`) are read from three places that currently hardcode "always required when invoice type selected": the Classic Checkout PHP validator, the Classic Checkout JS required-toggle, and the Block Checkout field registration + validate callbacks. No new files, no database migration — `get_option($key, 'yes')`'s default parameter covers existing installs.

**Tech Stack:** PHP 8.2 (WordPress/WooCommerce plugin), vanilla jQuery, WooCommerce Settings API, WooCommerce Blocks Additional Checkout Fields API (Store API).

**Spec:** `docs/superpowers/specs/2026-08-10-required-invoice-fields-design.md`

## Global Constraints

- Target version: **1.2.0** (bump from 1.1.0).
- All 4 new settings default to `'yes'` (required) — existing installs must behave identically to today until the admin changes a setting.
- ΑΦΜ format (`/^[0-9]{9}$/`) is validated whenever a value is present, regardless of the required/optional setting — never skip format validation.
- One setting per field, shared by Classic and Block checkout — do not create separate per-checkout-type settings.
- No activation-hook / database migration changes — rely on `get_option($key, 'yes')`'s default parameter.
- Text domain for all new user-facing strings: `greek-vat-invoices-for-woocommerce` (use `__()` / `esc_html__()`).
- `Requires at least: 5.0`, `Requires PHP: 7.0`, `WC requires at least: 3.0` (from the plugin header) — do not use PHP/WP/WC APIs newer than these floors.
- Donate link everywhere becomes `https://paypal.me/TheodoreSfakianakis` (was `https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com`).
- Verified fact (read directly from the installed WooCommerce 10.x source at `C:\xampp\htdocs\wordpress\wp-content\plugins\woocommerce\src\Blocks\Domain\Services\CheckoutFields.php`): a field's custom `validate_callback` completely replaces WooCommerce's own default required-check — setting `'required' => true/false` on a `woocommerce_register_additional_checkout_field()` call only affects the UI "(Optional)" label, never a second, redundant empty-check. `validate_callback` is invoked as `call_user_func($callback, $field_value, $field)` — the second argument is the full field array, so `$field['id']` is available inside shared callbacks.

---

### Task 1: Add required-field settings, fix uppercase setting bug, update settings-page donate link

**Files:**
- Modify: `includes/class-admin-settings.php`

**Interfaces:**
- Produces: options `GRVATIN_require_company`, `GRVATIN_require_vat`, `GRVATIN_require_doy`, `GRVATIN_require_activity` (checkbox, `'yes'`/`'no'`, default `'yes'`) — consumed by Tasks 2, 3, 4.
- Produces: fixes option id `GRVATIN_uppercase` → `GRVATIN_uppercase_fields` so it matches what every other file already reads (`checkout.js` localize params, `class-block-checkout.php::sanitize_text_upper()`, `class-checkout-fields.php` save methods, activation default) — no other file needs to change for this fix, they already read the correct name.

- [ ] **Step 1: Fix the uppercase setting id**

Find this in `get_settings()`:

```php
            array(
                'title' => __('Μετατροπή σε Κεφαλαία', 'greek-vat-invoices-for-woocommerce'),
                'desc' => __('Μετατροπή επωνυμίας και διεύθυνσης σε ΚΕΦΑΛΑΙΑ (απαίτηση AADE)', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_uppercase',
                'default' => 'yes',
                'type' => 'checkbox'
            ),
```

Replace with:

```php
            array(
                'title' => __('Μετατροπή σε Κεφαλαία', 'greek-vat-invoices-for-woocommerce'),
                'desc' => __('Μετατροπή επωνυμίας και διεύθυνσης σε ΚΕΦΑΛΑΙΑ (απαίτηση AADE)', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_uppercase_fields',
                'default' => 'yes',
                'type' => 'checkbox'
            ),
```

- [ ] **Step 2: Add the new "Υποχρεωτικά Πεδία Τιμολογίου" section**

Find this (the end of the existing settings array, right before the `return`):

```php
            array(
                'type' => 'sectionend',
                'id' => 'GRVATIN_general_settings'
            ),
        );

        return apply_filters('GRVATIN_settings', $settings);
```

Replace with:

```php
            array(
                'type' => 'sectionend',
                'id' => 'GRVATIN_general_settings'
            ),

            // Required Invoice Fields Section
            array(
                'title' => __('Υποχρεωτικά Πεδία Τιμολογίου', 'greek-vat-invoices-for-woocommerce'),
                'type' => 'title',
                'desc' => __('Επιλέξτε ποια πεδία θα είναι υποχρεωτικά όταν ο πελάτης επιλέξει Τιμολόγιο', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_required_fields_settings'
            ),

            array(
                'title' => __('Επωνυμία Επιχείρησης', 'greek-vat-invoices-for-woocommerce'),
                'desc' => __('Υποχρεωτική συμπλήρωση επωνυμίας', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_require_company',
                'default' => 'yes',
                'type' => 'checkbox'
            ),

            array(
                'title' => __('ΑΦΜ', 'greek-vat-invoices-for-woocommerce'),
                'desc' => __('Υποχρεωτική συμπλήρωση ΑΦΜ', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_require_vat',
                'default' => 'yes',
                'type' => 'checkbox'
            ),

            array(
                'title' => __('ΔΟΥ', 'greek-vat-invoices-for-woocommerce'),
                'desc' => __('Υποχρεωτική συμπλήρωση ΔΟΥ', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_require_doy',
                'default' => 'yes',
                'type' => 'checkbox'
            ),

            array(
                'title' => __('Επάγγελμα', 'greek-vat-invoices-for-woocommerce'),
                'desc' => __('Υποχρεωτική συμπλήρωση επαγγέλματος', 'greek-vat-invoices-for-woocommerce'),
                'id' => 'GRVATIN_require_activity',
                'default' => 'yes',
                'type' => 'checkbox'
            ),

            array(
                'type' => 'sectionend',
                'id' => 'GRVATIN_required_fields_settings'
            ),
        );

        return apply_filters('GRVATIN_settings', $settings);
```

Note: per Global Constraints, do **not** add these to the activation hook's `add_option(...)` block in the main plugin file — `get_option($key, 'yes')` already covers fresh and existing installs identically.

- [ ] **Step 3: Update the settings-page donate button link**

Find in `output_settings()`:

```php
        echo '<a href="https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com" target="_blank" class="grvatin-donate-btn">'; 
```

Replace with:

```php
        echo '<a href="https://paypal.me/TheodoreSfakianakis" target="_blank" class="grvatin-donate-btn">'; 
```

- [ ] **Step 4: Syntax-check the file**

Run: `"/c/xampp/php/php.exe" -l "C:/Users/user/Desktop/greek-vat-invoices-git/includes/class-admin-settings.php"`
Expected: `No syntax errors detected in C:/Users/user/Desktop/greek-vat-invoices-git/includes/class-admin-settings.php`

- [ ] **Step 5: Commit**

```bash
git add includes/class-admin-settings.php
git commit -m "Add per-field required/optional invoice settings, fix uppercase setting id"
```

---

### Task 2: Wire settings into Classic Checkout PHP validation

**Files:**
- Modify: `includes/class-checkout-fields.php`

**Interfaces:**
- Consumes: options `GRVATIN_require_company`, `GRVATIN_require_vat`, `GRVATIN_require_doy`, `GRVATIN_require_activity` (from Task 1).
- Produces: `validate_invoice_fields()` now only rejects an empty field when its setting is `'yes'`; ΑΦΜ format check now applies whenever a value is present regardless of the required setting. `remove_optional_text()` now only strips the "(optional)" label from fields that are currently required.

- [ ] **Step 1: Gate the required-field checks in `validate_invoice_fields()`**

Find:

```php
        if ($invoice_type === 'invoice') {
            // Validate required fields for invoice
            if (empty($_POST['billing_company'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_company', __('Η επωνυμία είναι υποχρεωτική για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
            
            if (empty($_POST['billing_vat_number'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_vat_number', __('Το ΑΦΜ είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            } elseif (isset($_POST['billing_vat_number']) && !preg_match('/^[0-9]{9}$/', sanitize_text_field(wp_unslash($_POST['billing_vat_number'])))) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_vat_number', __('Το ΑΦΜ πρέπει να είναι 9 ψηφία.', 'greek-vat-invoices-for-woocommerce'));
            }
            
            if (empty($_POST['billing_doy'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_doy', __('Η ΔΟΥ είναι υποχρεωτική για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
            
            if (empty($_POST['billing_business_activity'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_business_activity', __('Το επάγγελμα είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
        }
```

Replace with:

```php
        if ($invoice_type === 'invoice') {
            // Validate required fields for invoice (each gated by its own setting)
            if (get_option('GRVATIN_require_company', 'yes') === 'yes' && empty($_POST['billing_company'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_company', __('Η επωνυμία είναι υποχρεωτική για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
            
            if (get_option('GRVATIN_require_vat', 'yes') === 'yes' && empty($_POST['billing_vat_number'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_vat_number', __('Το ΑΦΜ είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            } elseif (!empty($_POST['billing_vat_number']) && !preg_match('/^[0-9]{9}$/', sanitize_text_field(wp_unslash($_POST['billing_vat_number'])))) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_vat_number', __('Το ΑΦΜ πρέπει να είναι 9 ψηφία.', 'greek-vat-invoices-for-woocommerce'));
            }
            
            if (get_option('GRVATIN_require_doy', 'yes') === 'yes' && empty($_POST['billing_doy'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_doy', __('Η ΔΟΥ είναι υποχρεωτική για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
            
            if (get_option('GRVATIN_require_activity', 'yes') === 'yes' && empty($_POST['billing_business_activity'])) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
                $errors->add('billing_business_activity', __('Το επάγγελμα είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
        }
```

**Why the `elseif` condition changed:** the original `elseif` was only ever reached when `billing_vat_number` was non-empty (the sibling `if (empty(...))` above it caught the empty case unconditionally). Now that the `if` is gated by the setting, an *optional and empty* ΑΦΜ would fall through to the `elseif` and incorrectly fail the 9-digit format check against an empty string. Checking `!empty($_POST['billing_vat_number'])` first fixes this — format is only checked when there's an actual value, matching the Global Constraint that format validation is independent of required/optional.

- [ ] **Step 2: Make `remove_optional_text()` reflect the real required state**

Find:

```php
    public function remove_optional_text($field, $key, $args, $value) {
        // Only apply to our invoice fields
        $invoice_fields = array('billing_company', 'billing_vat_number', 'billing_doy', 'billing_business_activity');
        
        if (in_array($key, $invoice_fields)) {
            // Remove optional text
            $field = str_replace('<span class="optional">(προαιρετικό)</span>', '', $field);
            $field = str_replace('<span class="optional">(optional)</span>', '', $field);
        }
        
        return $field;
    }
```

Replace with:

```php
    public function remove_optional_text($field, $key, $args, $value) {
        // Only strip the "(optional)" label from fields that are currently required —
        // fields the admin has marked optional should keep showing it.
        $required_option_map = array(
            'billing_company' => 'GRVATIN_require_company',
            'billing_vat_number' => 'GRVATIN_require_vat',
            'billing_doy' => 'GRVATIN_require_doy',
            'billing_business_activity' => 'GRVATIN_require_activity',
        );

        if (isset($required_option_map[$key]) && get_option($required_option_map[$key], 'yes') === 'yes') {
            $field = str_replace('<span class="optional">(προαιρετικό)</span>', '', $field);
            $field = str_replace('<span class="optional">(optional)</span>', '', $field);
        }
        
        return $field;
    }
```

- [ ] **Step 3: Syntax-check the file**

Run: `"/c/xampp/php/php.exe" -l "C:/Users/user/Desktop/greek-vat-invoices-git/includes/class-checkout-fields.php"`
Expected: `No syntax errors detected in C:/Users/user/Desktop/greek-vat-invoices-git/includes/class-checkout-fields.php`

- [ ] **Step 4: Commit**

```bash
git add includes/class-checkout-fields.php
git commit -m "Gate Classic Checkout required-field validation on per-field settings"
```

---

### Task 3: Wire settings into Classic Checkout JS

**Files:**
- Modify: `greek-vat-invoices-for-woocommerce.php`
- Modify: `assets/js/checkout.js`

**Interfaces:**
- Consumes: options `GRVATIN_require_company`, `GRVATIN_require_vat`, `GRVATIN_require_doy`, `GRVATIN_require_activity` (from Task 1).
- Produces: `grvatin_params` JS object gains 4 new keys (`require_company`, `require_vat`, `require_doy`, `require_activity`, each `'yes'`/`'no'`) — consumed by `checkout.js`. `toggleInvoiceFields()` now sets the native `required` attribute per field instead of blanket-applying it to the whole `.grvatin-invoice-fields` group.

- [ ] **Step 1: Localize the 4 new settings**

In `greek-vat-invoices-for-woocommerce.php`, find:

```php
            wp_localize_script('wcgvi-checkout', 'grvatin_params', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('GRVATIN_nonce'),
                'uppercase' => get_option('GRVATIN_uppercase_fields', 'yes'),
                'validating_text' => __('Επικύρωση...', 'greek-vat-invoices-for-woocommerce'),
                'valid_text' => __('Έγκυρο', 'greek-vat-invoices-for-woocommerce'),
                'invalid_text' => __('Μη έγκυρο ΑΦΜ', 'greek-vat-invoices-for-woocommerce'),
                'error_text' => __('Σφάλμα επικύρωσης ΑΦΜ', 'greek-vat-invoices-for-woocommerce')
            ));
```

Replace with:

```php
            wp_localize_script('wcgvi-checkout', 'grvatin_params', array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => wp_create_nonce('GRVATIN_nonce'),
                'uppercase' => get_option('GRVATIN_uppercase_fields', 'yes'),
                'require_company' => get_option('GRVATIN_require_company', 'yes'),
                'require_vat' => get_option('GRVATIN_require_vat', 'yes'),
                'require_doy' => get_option('GRVATIN_require_doy', 'yes'),
                'require_activity' => get_option('GRVATIN_require_activity', 'yes'),
                'validating_text' => __('Επικύρωση...', 'greek-vat-invoices-for-woocommerce'),
                'valid_text' => __('Έγκυρο', 'greek-vat-invoices-for-woocommerce'),
                'invalid_text' => __('Μη έγκυρο ΑΦΜ', 'greek-vat-invoices-for-woocommerce'),
                'error_text' => __('Σφάλμα επικύρωσης ΑΦΜ', 'greek-vat-invoices-for-woocommerce')
            ));
```

- [ ] **Step 2: Syntax-check the PHP file**

Run: `"/c/xampp/php/php.exe" -l "C:/Users/user/Desktop/greek-vat-invoices-git/greek-vat-invoices-for-woocommerce.php"`
Expected: `No syntax errors detected in C:/Users/user/Desktop/greek-vat-invoices-git/greek-vat-invoices-for-woocommerce.php`

- [ ] **Step 3: Make the required-toggle per-field in `checkout.js`**

Find:

```javascript
            if (invoiceType === 'invoice') {
                $invoiceFields.addClass('visible').slideDown(300);
                $companyField.addClass('visible').slideDown(300);
                
                // Show Article 39a checkbox only for Greek businesses
                var country = $('#billing_country').val();
                if (country === 'GR' && $article39aWrapper.length) {
                    $article39aWrapper.slideDown(300);
                }
                
                $invoiceFields.find('input').prop('required', true);
                $companyField.find('input').prop('required', true);
            } else {
```

Replace with:

```javascript
            if (invoiceType === 'invoice') {
                $invoiceFields.addClass('visible').slideDown(300);
                $companyField.addClass('visible').slideDown(300);
                
                // Show Article 39a checkbox only for Greek businesses
                var country = $('#billing_country').val();
                if (country === 'GR' && $article39aWrapper.length) {
                    $article39aWrapper.slideDown(300);
                }
                
                $('#billing_vat_number').prop('required', grvatin_params.require_vat === 'yes');
                $('#billing_doy').prop('required', grvatin_params.require_doy === 'yes');
                $('#billing_business_activity').prop('required', grvatin_params.require_activity === 'yes');
                $companyField.find('input').prop('required', grvatin_params.require_company === 'yes');
            } else {
```

The `else` branch (receipt selected) is unchanged — it already blanket-clears `required` to `false` on the whole group, which stays correct regardless of the new settings.

- [ ] **Step 4: Syntax-check the JS file**

Run: `node --check "C:/Users/user/Desktop/greek-vat-invoices-git/assets/js/checkout.js"`
Expected: no output, exit code 0

- [ ] **Step 5: Commit**

```bash
git add greek-vat-invoices-for-woocommerce.php assets/js/checkout.js
git commit -m "Wire per-field required settings into Classic Checkout JS"
```

---

### Task 4: Wire settings into Block Checkout

**Files:**
- Modify: `includes/class-block-checkout.php`

**Interfaces:**
- Consumes: options `GRVATIN_require_company`, `GRVATIN_require_vat`, `GRVATIN_require_doy`, `GRVATIN_require_activity` (from Task 1).
- Produces: the 4 fields' `required` flag at registration now reflects the real setting (fixes the reported "(Optional)" label bug). `validate_vat_number($value)` and `validate_invoice_required_field($value, $field)` (signature gains `$field`) now skip the empty-check for fields marked optional; ΑΦΜ format check remains unconditional whenever a value is present.

- [ ] **Step 1: Make the 4 `required` flags setting-driven**

Find:

```php
        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/company-name',
            'label'            => __('Επωνυμία Επιχείρησης', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 1,
            'required'         => false,
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_invoice_required_field'),
        ));

        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/vat-number',
            'label'            => __('ΑΦΜ', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 2,
            'required'         => true,
            'attributes'       => array(
                'maxLength'    => 9,
                'pattern'      => '[0-9]{9}',
                'title'        => __('Το ΑΦΜ πρέπει να είναι 9 ψηφία', 'greek-vat-invoices-for-woocommerce'),
            ),
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_vat_number'),
        ));

        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/doy',
            'label'            => __('ΔΟΥ', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 3,
            'required'         => false,
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_invoice_required_field'),
        ));

        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/business-activity',
            'label'            => __('Επάγγελμα', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 4,
            'required'         => false,
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_invoice_required_field'),
        ));
```

Replace with:

```php
        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/company-name',
            'label'            => __('Επωνυμία Επιχείρησης', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 1,
            'required'         => get_option('GRVATIN_require_company', 'yes') === 'yes',
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_invoice_required_field'),
        ));

        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/vat-number',
            'label'            => __('ΑΦΜ', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 2,
            'required'         => get_option('GRVATIN_require_vat', 'yes') === 'yes',
            'attributes'       => array(
                'maxLength'    => 9,
                'pattern'      => '[0-9]{9}',
                'title'        => __('Το ΑΦΜ πρέπει να είναι 9 ψηφία', 'greek-vat-invoices-for-woocommerce'),
            ),
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_vat_number'),
        ));

        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/doy',
            'label'            => __('ΔΟΥ', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 3,
            'required'         => get_option('GRVATIN_require_doy', 'yes') === 'yes',
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_invoice_required_field'),
        ));

        woocommerce_register_additional_checkout_field(array(
            'id'               => 'grvatin/business-activity',
            'label'            => __('Επάγγελμα', 'greek-vat-invoices-for-woocommerce'),
            'location'         => $location,
            'type'             => 'text',
            'index'            => $base_index + 4,
            'required'         => get_option('GRVATIN_require_activity', 'yes') === 'yes',
            'sanitize_callback' => array($this, 'sanitize_text_upper'),
            'validate_callback' => array($this, 'validate_invoice_required_field'),
        ));
```

- [ ] **Step 2: Gate `validate_vat_number()` on the setting, keep format check unconditional**

Find:

```php
    public function validate_vat_number($value) {
        $invoice_type = $this->get_submitted_invoice_type();

        if ($invoice_type !== 'invoice') {
            return;
        }

        if (empty($value)) {
            return new WP_Error('required_vat', __('Το ΑΦΜ είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
        }

        if (!preg_match('/^[0-9]{9}$/', $value)) {
            return new WP_Error('invalid_vat', __('Το ΑΦΜ πρέπει να είναι 9 ψηφία.', 'greek-vat-invoices-for-woocommerce'));
        }
    }
```

Replace with:

```php
    public function validate_vat_number($value) {
        $invoice_type = $this->get_submitted_invoice_type();

        if ($invoice_type !== 'invoice') {
            return;
        }

        if (empty($value)) {
            if (get_option('GRVATIN_require_vat', 'yes') === 'yes') {
                return new WP_Error('required_vat', __('Το ΑΦΜ είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
            }
            return;
        }

        if (!preg_match('/^[0-9]{9}$/', $value)) {
            return new WP_Error('invalid_vat', __('Το ΑΦΜ πρέπει να είναι 9 ψηφία.', 'greek-vat-invoices-for-woocommerce'));
        }
    }
```

- [ ] **Step 3: Make `validate_invoice_required_field()` per-field-aware**

This callback is shared by `company-name`, `doy`, and `business-activity`. It needs the field's id (passed as the 2nd argument by WooCommerce — verified in `CheckoutFields.php::validate_field()`) to know which setting to check.

Find:

```php
    public function validate_invoice_required_field($value) {
        $invoice_type = $this->get_submitted_invoice_type();

        if ($invoice_type !== 'invoice') {
            return;
        }

        if (empty($value)) {
            return new WP_Error('required_field', __('Αυτό το πεδίο είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
        }
    }
```

Replace with:

```php
    public function validate_invoice_required_field($value, $field) {
        $invoice_type = $this->get_submitted_invoice_type();

        if ($invoice_type !== 'invoice') {
            return;
        }

        if (!empty($value)) {
            return;
        }

        $required_option_map = array(
            'grvatin/company-name'      => 'GRVATIN_require_company',
            'grvatin/doy'               => 'GRVATIN_require_doy',
            'grvatin/business-activity' => 'GRVATIN_require_activity',
        );

        $option_id = isset($field['id'], $required_option_map[$field['id']]) ? $required_option_map[$field['id']] : null;

        if ($option_id === null || get_option($option_id, 'yes') === 'yes') {
            return new WP_Error('required_field', __('Αυτό το πεδίο είναι υποχρεωτικό για την έκδοση τιμολογίου.', 'greek-vat-invoices-for-woocommerce'));
        }
    }
```

(Defensive fallback: if `$field['id']` is ever missing or unrecognized, the field is treated as required — matches the "default all 4 required" rule and fails safe rather than silently making an unrecognized field optional.)

- [ ] **Step 4: Syntax-check the file**

Run: `"/c/xampp/php/php.exe" -l "C:/Users/user/Desktop/greek-vat-invoices-git/includes/class-block-checkout.php"`
Expected: `No syntax errors detected in C:/Users/user/Desktop/greek-vat-invoices-git/includes/class-block-checkout.php`

- [ ] **Step 5: Commit**

```bash
git add includes/class-block-checkout.php
git commit -m "Gate Block Checkout required flags and validation on per-field settings"
```

---

### Task 5: Update donate link everywhere else

**Files:**
- Modify: `greek-vat-invoices-for-woocommerce.php`
- Modify: `readme.txt`
- Modify: `README.md`
- Modify: `languages/README.md`

**Interfaces:** None (pure text replacement, no behavior change).

- [ ] **Step 1: Main plugin file — Author URI header**

Find:

```php
 * Author URI: https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com
```

Replace with:

```php
 * Author URI: https://paypal.me/TheodoreSfakianakis
```

- [ ] **Step 2: `readme.txt` — 3 occurrences**

Find (Coming Soon Features section):
```
Support development to help prioritize these features! [Donate via PayPal](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with:
```
Support development to help prioritize these features! [Donate via PayPal](https://paypal.me/TheodoreSfakianakis)
```

Find (FAQ "How can I support development?"):
```
You can donate via PayPal to help fund future features: [https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with:
```
You can donate via PayPal to help fund future features: [https://paypal.me/TheodoreSfakianakis](https://paypal.me/TheodoreSfakianakis)
```

Find (Developer section):
```
* Donate: [https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with:
```
* Donate: [https://paypal.me/TheodoreSfakianakis](https://paypal.me/TheodoreSfakianakis)
```

- [ ] **Step 3: `README.md` — 3 occurrences**

Find:
```
- 💰 Support: [PayPal Donate](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with:
```
- 💰 Support: [PayPal Donate](https://paypal.me/TheodoreSfakianakis)
```

Find:
```
[![Donate with PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with (only the link target changes — the badge image URL stays a paypalobjects.com asset):
```
[![Donate with PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://paypal.me/TheodoreSfakianakis)
```

Find:
```
- 💰 **Donate**: [PayPal](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with:
```
- 💰 **Donate**: [PayPal](https://paypal.me/TheodoreSfakianakis)
```

- [ ] **Step 4: `languages/README.md` — 1 occurrence**

Find:
```
**Donate:** [PayPal](https://www.paypal.com/donate?business=theodore.sfakianakis@gmail.com)
```
Replace with:
```
**Donate:** [PayPal](https://paypal.me/TheodoreSfakianakis)
```

- [ ] **Step 5: Confirm no old links remain**

Run: `grep -rn "paypal.com/donate" "C:/Users/user/Desktop/greek-vat-invoices-git" --include=*.php --include=*.md --include=*.txt`
Expected: no output (empty result)

- [ ] **Step 6: Syntax-check the PHP file**

Run: `"/c/xampp/php/php.exe" -l "C:/Users/user/Desktop/greek-vat-invoices-git/greek-vat-invoices-for-woocommerce.php"`
Expected: `No syntax errors detected in C:/Users/user/Desktop/greek-vat-invoices-git/greek-vat-invoices-for-woocommerce.php`

- [ ] **Step 7: Commit**

```bash
git add greek-vat-invoices-for-woocommerce.php readme.txt README.md languages/README.md
git commit -m "Update donate link to paypal.me/TheodoreSfakianakis"
```

---

### Task 6: Version bump and changelog

**Files:**
- Modify: `greek-vat-invoices-for-woocommerce.php`
- Modify: `readme.txt`
- Modify: `WHATSNEW.txt`

**Interfaces:** None (metadata only). Run this task last among the code tasks, after Tasks 1-5 are committed, so the changelog text matches what was actually built.

- [ ] **Step 1: Bump version in the main plugin file**

Find:

```php
 * Version: 1.1.0
```

Replace with:

```php
 * Version: 1.2.0
```

Find:

```php
define('GRVATIN_VERSION', '1.1.0');
```

Replace with:

```php
define('GRVATIN_VERSION', '1.2.0');
```

- [ ] **Step 2: Update `readme.txt` stable tag**

Find:

```
Stable tag: 1.1.0
```

Replace with:

```
Stable tag: 1.2.0
```

- [ ] **Step 3: Add changelog and upgrade notice entries to `readme.txt`**

Find:

```
== Changelog ==

= 1.1.0 (2026-03-13) =
```

Replace with:

```
== Changelog ==

= 1.2.0 (2026-08-10) =
* Added per-field required/optional settings for invoice fields (Company Name, ΑΦΜ, ΔΟΥ, Business Activity) — all 4 required by default
* Fixed Block Checkout showing Company Name, ΔΟΥ, and Business Activity as "(Optional)" while the server actually required them
* Fixed the uppercase-conversion setting not being saved under the option it was read from
* Updated donate link

= 1.1.0 (2026-03-13) =
```

Find:

```
== Upgrade Notice ==

= 1.1.0 =
```

Replace with:

```
== Upgrade Notice ==

= 1.2.0 =
New: choose which invoice fields (Company, ΑΦΜ, ΔΟΥ, Business Activity) are required vs optional, per field. All 4 remain required by default, so behavior is unchanged unless you opt in. Also fixes the uppercase-conversion setting and updates the donate link.

= 1.1.0 =
```

- [ ] **Step 4: Add a `WHATSNEW.txt` entry**

Find:

```
============================================================
 Greek VAT & Invoices for WooCommerce - What's New
============================================================

Version 1.1.0 (2026-03-13)
------------------------------------------------------------
```

Replace with:

```
============================================================
 Greek VAT & Invoices for WooCommerce - What's New
============================================================

Version 1.2.0 (2026-08-10)
------------------------------------------------------------

 ★ Per-Field Required/Optional Invoice Settings

   New settings section "Υποχρεωτικά Πεδία Τιμολογίου" under
   WooCommerce → Settings → Ελληνικά Τιμολόγια lets the store
   admin mark each of the 4 invoice fields as required or
   optional independently: Company Name, ΑΦΜ, ΔΟΥ, Business
   Activity. All 4 default to required, matching prior behavior
   for existing installs.

   New options (all default 'yes'):
   • GRVATIN_require_company
   • GRVATIN_require_vat
   • GRVATIN_require_doy
   • GRVATIN_require_activity

   ΑΦΜ format (9 digits) is still validated whenever a value is
   entered, regardless of the required/optional setting.

   Modified files:
   • includes/class-admin-settings.php — new settings section
   • includes/class-checkout-fields.php — gated PHP validation
     and optional-label display for Classic Checkout
   • assets/js/checkout.js — per-field required toggle
   • includes/class-block-checkout.php — gated required flags
     and validate callbacks for Block Checkout
   • greek-vat-invoices-for-woocommerce.php — localized the new
     settings to checkout.js

 ★ Bug Fix: Block Checkout "(Optional)" Label Mismatch

   Previously only ΑΦΜ was registered with required => true in
   Block Checkout; Company Name, ΔΟΥ, and Business Activity were
   registered required => false even though server-side
   validation already rejected them empty. Block Checkout's
   "(Optional)" label now accurately reflects each field's real
   required setting.

 ★ Bug Fix: Uppercase Conversion Setting

   The "Μετατροπή σε Κεφαλαία" checkbox saved to option
   GRVATIN_uppercase, but every consumer read
   GRVATIN_uppercase_fields — so toggling it never had any
   effect. The setting id now matches what's actually read.

 ★ Donate Link Updated

   Replaced the PayPal donate link with
   https://paypal.me/TheodoreSfakianakis across the plugin
   header, admin settings page, and all documentation files.

------------------------------------------------------------

Version 1.1.0 (2026-03-13)
------------------------------------------------------------
```

- [ ] **Step 5: Syntax-check the PHP file**

Run: `"/c/xampp/php/php.exe" -l "C:/Users/user/Desktop/greek-vat-invoices-git/greek-vat-invoices-for-woocommerce.php"`
Expected: `No syntax errors detected in C:/Users/user/Desktop/greek-vat-invoices-git/greek-vat-invoices-for-woocommerce.php`

- [ ] **Step 6: Commit**

```bash
git add greek-vat-invoices-for-woocommerce.php readme.txt WHATSNEW.txt
git commit -m "Bump version to 1.2.0"
```

---

### Task 7: Verify locally against XAMPP WordPress + WooCommerce

**Files:** None modified — this is a verification-only task using the Browser tool against `C:\xampp\htdocs\wordpress`.

**Interfaces:** Consumes the fully committed state of Tasks 1-6.

- [ ] **Step 1: Deploy the updated plugin into the XAMPP site**

Copy every file changed in Tasks 1-6 from `C:\Users\user\Desktop\greek-vat-invoices-git\` into `C:\xampp\htdocs\wordpress\wp-content\plugins\greek-vat-invoices-for-woocommerce\`, overwriting the existing (1.1.0) copies:
- `greek-vat-invoices-for-woocommerce.php`
- `includes/class-admin-settings.php`
- `includes/class-checkout-fields.php`
- `includes/class-block-checkout.php`
- `assets/js/checkout.js`
- `readme.txt`
- `WHATSNEW.txt`

- [ ] **Step 2: Confirm the site loads and the plugin is active**

Open `http://localhost/wordpress/wp-admin/plugins.php` in the Browser tool, log in if needed, and confirm "Greek VAT & Invoices for WooCommerce" is listed as version 1.2.0 and active (Apache/MySQL are already running per earlier check).

- [ ] **Step 3: Verify the new settings section**

Navigate to `http://localhost/wordpress/wp-admin/admin.php?page=wc-settings&tab=greek_vat_invoices`. Confirm:
- A "Υποχρεωτικά Πεδία Τιμολογίου" section appears with 4 checkboxes, all checked by default.
- "Μετατροπή σε Κεφαλαία" checkbox is present (fix from Task 1).
- The donate button at the bottom links to `paypal.me/TheodoreSfakianakis` (inspect the href).

- [ ] **Step 4: Verify Classic Checkout — defaults (all required)**

Set `grvatin_checkout_type` to Classic (if not already), save. Go to the shop, add a product to cart, go to checkout, select "Τιμολόγιο". Confirm ΑΦΜ, ΔΟΥ, Επάγγελμα, and Επωνυμία Επιχείρησης all show without "(προαιρετικό)" and block submission when empty (browser-native required prompt or WooCommerce error on submit).

- [ ] **Step 5: Verify Classic Checkout — one field optional (ΔΟΥ)**

In settings, uncheck "ΔΟΥ" required, save. Reload checkout, select "Τιμολόγιο". Confirm the ΔΟΥ field now shows "(προαιρετικό)" and the order can be submitted with ΔΟΥ empty, while ΑΦΜ/Company/Activity still block empty submission. Re-check "ΔΟΥ" required afterward.

- [ ] **Step 6: Verify Classic Checkout — ΑΦΜ optional (the riskiest code path)**

In settings, uncheck "ΑΦΜ" required, save. Reload checkout, select "Τιμολόγιο":
- Leave ΑΦΜ empty, fill in the other required fields, submit. Confirm the order goes through with no "ΑΦΜ είναι υποχρεωτικό" error — this exercises the `elseif` fix in Task 2 Step 1 (an optional+empty ΑΦΜ must not fall through to the format check).
- Reload, this time type a malformed ΑΦΜ (e.g. `123`) and submit. Confirm the "Το ΑΦΜ πρέπει να είναι 9 ψηφία" format error still fires even though ΑΦΜ is optional.
- Re-check "ΑΦΜ" required afterward.

- [ ] **Step 7: Verify Classic Checkout — receipt unaffected**

Select "Απόδειξη" instead of "Τιμολόγιο". Confirm none of the 4 fields are required or visible, regardless of settings.

- [ ] **Step 8: Verify Block Checkout — required/optional label and enforcement**

In settings, set `grvatin_checkout_type` to Block, save. Uncheck "ΔΟΥ" required. Go to checkout (block-based), select "Τιμολόγιο". Confirm ΔΟΥ shows "(Optional)" and the other 3 fields don't. Submit with ΔΟΥ empty — order should go through. Re-enable "ΔΟΥ" required, reload checkout, confirm ΔΟΥ now blocks empty submission and no longer shows "(Optional)".

- [ ] **Step 9: Verify Block Checkout — ΑΦΜ optional**

Uncheck "ΑΦΜ" required, save, reload checkout, select "Τιμολόγιο". Confirm ΑΦΜ shows "(Optional)" and an empty ΑΦΜ submits successfully. Then type a malformed ΑΦΜ (e.g. `123`) and confirm the format error still fires (exercises the `validate_vat_number()` empty-check-then-format-check ordering from Task 4 Step 2, independently of the Classic code path tested in Step 6). Re-check "ΑΦΜ" required afterward.

- [ ] **Step 10: Verify Block Checkout — receipt unaffected**

With ΔΟΥ and ΑΦΜ back to required, select "Απόδειξη" instead of "Τιμολόγιο". Confirm none of the 4 fields are required or visible. This exercises the `get_submitted_invoice_type() !== 'invoice'` early-return in `validate_vat_number()` / `validate_invoice_required_field()`, which is separate code from the Classic Checkout path already verified in Step 7.

- [ ] **Step 11: Verify the uppercase-setting fix**

Toggle "Μετατροπή σε Κεφαλαία" off, save. On checkout, type a lowercase company name into ΔΟΥ/Company/Activity fields and confirm they are **not** auto-uppercased (this previously had no effect regardless of the toggle — confirm the toggle now actually works). Toggle it back on and confirm they **are** uppercased.

- [ ] **Step 12: Reset test settings**

Re-check all 4 required-field settings and leave "Μετατροπή σε Κεφαλαία" checked (restore defaults) before moving on, so the XAMPP site reflects the shipped defaults.

- [ ] **Step 13: Report results**

Summarize pass/fail for each of Steps 4-11 before proceeding to Task 8. Do not proceed to publishing if any step failed — go back and fix the relevant task first.

---

### Task 8: Publish — GitHub, then WordPress.org SVN

**Files:**
- Push: `C:\Users\user\Desktop\greek-vat-invoices-git` → `https://github.com/TheoSfak/greek-vat-invoices-for-woo.git` (`main`)
- Mirror into: `C:\Users\user\Desktop\svn-greek-vat\trunk`
- Tag: `C:\Users\user\Desktop\svn-greek-vat\tags\1.2.0`

**Interfaces:** Consumes the verified, committed state from Tasks 1-7. This task performs the two "visible to others" actions (`git push`, `svn commit`) — **stop and confirm with the user before Steps 2 and 5**, even though the overall workflow was pre-approved in the spec; a general plan approval isn't standing authorization to push at whatever moment this step is reached.

- [ ] **Step 1: Review the full local commit history for this feature**

Run: `cd "C:/Users/user/Desktop/greek-vat-invoices-git" && git log --oneline -8`
Expected: the 6 commits from Tasks 1-6 (settings, classic PHP, classic JS, block checkout, donate link, version bump), newest first.

- [ ] **Step 2: Push to GitHub (confirm with user first)**

```bash
cd "C:/Users/user/Desktop/greek-vat-invoices-git"
git push origin main
```

- [ ] **Step 3: Mirror the changed files into the SVN trunk**

Copy the same 7 files listed in Task 7 Step 1 from `C:\Users\user\Desktop\greek-vat-invoices-git\` into `C:\Users\user\Desktop\svn-greek-vat\trunk\`, overwriting the existing (1.1.0) copies.

- [ ] **Step 4: Review the SVN diff**

```bash
cd "C:/Users/user/Desktop/svn-greek-vat"
svn status
svn diff trunk
```
Expected: modifications only to the 7 mirrored files, no unexpected additions/deletions.

- [ ] **Step 5: Commit to WordPress.org SVN (confirm with user first)**

```bash
cd "C:/Users/user/Desktop/svn-greek-vat"
svn commit trunk -m "1.2.0: per-field required/optional invoice settings, Block Checkout label fix, uppercase setting fix, donate link update"
```

- [ ] **Step 6: Cut the 1.2.0 release tag**

```bash
cd "C:/Users/user/Desktop/svn-greek-vat"
svn copy trunk tags/1.2.0
svn commit tags/1.2.0 -m "Tag 1.2.0"
```

- [ ] **Step 7: Confirm the release is live**

Fetch `https://wordpress.org/plugins/greek-vat-invoices-for-woocommerce/` and confirm the listed version is 1.2.0 (WordPress.org typically updates within a few minutes of the SVN commit).
