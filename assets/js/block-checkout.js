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
 * validation store: hiding a field via CSS does not, by itself, tell the
 * checkout block that the field is no longer required, so leaving that field
 * empty otherwise blocks "Place Order" even though the customer cannot see
 * or fill it in. This explicitly clears each dependent field's validation
 * error whenever it is hidden, and (re)applies it when the field is visible,
 * required by the admin setting, and currently empty.
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
        return window.grvatin_block_params || {};
    }

    function getValidationDispatch() {
        if (!window.wp || !window.wp.data || typeof window.wp.data.dispatch !== 'function') {
            return null;
        }
        return window.wp.data.dispatch('wc/store/validation');
    }

    function updateFieldValidation(field, isInvoice) {
        var validation = getValidationDispatch();
        if (!validation) return;

        var wrapperEl = document.querySelector('.' + field.wrapper);
        var inputEl = wrapperEl ? wrapperEl.querySelector('input') : null;
        var value = inputEl ? inputEl.value.trim() : '';
        var params = getParams();
        var isRequired = params[field.requiredKey] === 'yes';

        if (isInvoice && isRequired && !value) {
            var errors = {};
            errors[field.id] = {
                message: params.required_text || 'This field is required.',
                hidden: false
            };
            validation.setValidationErrors(errors);
        } else {
            validation.clearValidationError(field.id);
        }
    }

    function toggleFields() {
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
            updateFieldValidation(field, isInvoice);
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
                updateFieldValidation(field, isInvoiceTypeSelected());
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
