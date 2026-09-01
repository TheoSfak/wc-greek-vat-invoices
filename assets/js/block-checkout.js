/**
 * Greek VAT Invoices — Block Checkout conditional field visibility
 * Shows/hides VAT, DOY, and Business Activity fields based on invoice type selection.
 * Fields may appear in 'contact' (top) or 'order' (bottom) section depending on settings.
 *
 * DOM structure:
 *   Select wrapper: .wc-block-components-select-input-grvatin-invoice-type
 *   Text wrappers:  .wc-block-components-address-form__grvatin-vat-number etc.
 *
 * Also mirrors the visibility toggle into WooCommerce Blocks' own client-side
 * validation store (wc/store/validation). Hiding a field via CSS does not,
 * by itself, tell the checkout block the field is no longer required: the
 * PHP side (class-block-checkout.php) registers each field's 'required' as
 * a rule conditional on the sibling invoice-type field, but WooCommerce
 * Blocks' input validator only re-runs on its own value changing, not on a
 * 'required' prop flip alone — so switching invoice type without also
 * touching one of these four fields leaves a stale validation state.
 *
 * WooCommerce Blocks keys validation-store entries as `${location}_${id}`
 * (e.g. "contact_grvatin/vat-number", "order_grvatin/doy" — see
 * CheckoutFieldsSchema and wc-blocks-data's own field-key mapper), not the
 * bare field id, so every dispatch below is built through errorKey().
 */
(function () {
    'use strict';

    var SELECT_WRAPPER = 'wc-block-components-select-input-grvatin-invoice-type';
    var DEPENDENT_FIELDS = [
        { wrapper: 'wc-block-components-address-form__grvatin-company-name', id: 'grvatin/company-name', requiredKey: 'require_company' },
        { wrapper: 'wc-block-components-address-form__grvatin-vat-number', id: 'grvatin/vat-number', requiredKey: 'require_vat' },
        { wrapper: 'wc-block-components-address-form__grvatin-doy', id: 'grvatin/doy', requiredKey: 'require_doy' },
        { wrapper: 'wc-block-components-address-form__grvatin-business-activity', id: 'grvatin/business-activity', requiredKey: 'require_activity' }
    ];

    function getParams() {
        return window.grvatin_block_params || null;
    }

    function errorKey(field, params) {
        return (params.location || 'contact') + '_' + field.id;
    }

    function getValidationApi() {
        if (!window.wp || !window.wp.data || typeof window.wp.data.dispatch !== 'function' || typeof window.wp.data.select !== 'function') {
            return null;
        }
        return {
            dispatch: window.wp.data.dispatch('wc/store/validation'),
            select: window.wp.data.select('wc/store/validation')
        };
    }

    function updateFieldValidation(field, isInvoice, params) {
        var api = getValidationApi();
        if (!api || !api.dispatch || !api.select) return;

        var key = errorKey(field, params);

        if (!isInvoice) {
            // Receipt selected: this field cannot be relevant, regardless of
            // what set the error (our own required check, or WooCommerce's
            // own native validator e.g. a malformed ΑΦΜ typed earlier while
            // Τιμολόγιο was selected) — always safe to clear.
            api.dispatch.clearValidationError(key);
            return;
        }

        var wrapperEl = document.querySelector('.' + field.wrapper);
        var inputEl = wrapperEl ? wrapperEl.querySelector('input') : null;
        if (!inputEl) return;

        var value = inputEl.value.trim();
        var isRequired = params[field.requiredKey] === 'yes';
        var requiredText = params.required_text || 'This field is required.';

        if (isRequired && !value) {
            var errors = {};
            errors[key] = {
                message: requiredText,
                hidden: false
            };
            api.dispatch.setValidationErrors(errors);
        } else {
            // Only clear an error this script could plausibly have set —
            // never stomp a WooCommerce-native error (e.g. an invalid ΑΦΜ
            // format) that happens to share this field's key.
            var existing = api.select.getValidationError(key);
            if (existing && existing.message === requiredText) {
                api.dispatch.clearValidationError(key);
            }
        }
    }

    function toggleFields() {
        var params = getParams();
        if (!params) return;

        var selectWrapper = document.querySelector('.' + SELECT_WRAPPER);
        if (!selectWrapper) return;

        var select = selectWrapper.querySelector('select');
        if (!select) return;

        var isInvoice = select.value === 'invoice';

        for (var i = 0; i < DEPENDENT_FIELDS.length; i++) {
            var field = DEPENDENT_FIELDS[i];
            var el = document.querySelector('.' + field.wrapper);
            if (el) {
                el.style.display = isInvoice ? '' : 'none';
            }
            updateFieldValidation(field, isInvoice, params);
        }
    }

    function fieldForInput(inputEl) {
        for (var i = 0; i < DEPENDENT_FIELDS.length; i++) {
            if (inputEl.closest('.' + DEPENDENT_FIELDS[i].wrapper)) {
                return DEPENDENT_FIELDS[i];
            }
        }
        return null;
    }

    function isInvoiceTypeSelected() {
        var selectWrapper = document.querySelector('.' + SELECT_WRAPPER);
        var select = selectWrapper ? selectWrapper.querySelector('select') : null;
        return !!select && select.value === 'invoice';
    }

    function init() {
        var checkoutForm = document.querySelector('.wc-block-checkout');
        if (!checkoutForm) return;

        toggleFields();

        checkoutForm.addEventListener('change', function (e) {
            if (e.target && e.target.tagName === 'SELECT') {
                var wrapper = e.target.closest('.' + SELECT_WRAPPER);
                if (wrapper) {
                    toggleFields();
                }
            }
        });

        checkoutForm.addEventListener('input', function (e) {
            if (!e.target || e.target.tagName !== 'INPUT') return;
            var field = fieldForInput(e.target);
            if (field) {
                var params = getParams();
                if (params) {
                    updateFieldValidation(field, isInvoiceTypeSelected(), params);
                }
            }
        });

        var debounceTimer;
        new MutationObserver(function () {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(toggleFields, 50);
        }).observe(checkoutForm, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
