jQuery(document).ready(function($) {
    'use strict';
    
    var wcgviAdmin = {
        
        /**
         * Initialize
         */
        init: function() {
            this.bindEvents();
            this.toggleAADECredentials();
            this.initPasswordToggle();
        },
        
        /**
         * Bind events
         */
        bindEvents: function() {
            // Manual VAT validation button
            $(document).on('click', '.wcgvi-validate-vat-btn', function(e) {
                e.preventDefault();
                wcgviAdmin.validateVAT($(this));
            });
            
            // Regenerate invoice button
            $(document).on('click', '.wcgvi-regenerate-invoice', function(e) {
                e.preventDefault();
                wcgviAdmin.regenerateInvoice($(this));
            });
            
            // Upload invoice button
            $(document).on('click', '.wcgvi-upload-invoice-btn', function(e) {
                e.preventDefault();
                wcgviAdmin.uploadInvoice($(this));
            });
            
            // Test connection buttons
            $(document).on('click', '.wcgvi-test-connection', function(e) {
                e.preventDefault();
                wcgviAdmin.testConnection($(this));
            });
            
            // Greek VAT validation method change
            $(document).on('change', '#wcgvi_greek_vat_validation_method', function() {
                wcgviAdmin.toggleAADECredentials();
            });
        },
        
        /**
         * Toggle AADE credentials visibility
         */
        toggleAADECredentials: function() {
            var method = $('#wcgvi_greek_vat_validation_method').val();
            var $usernameRow = $('#wcgvi_aade_username').closest('tr');
            var $passwordRow = $('#wcgvi_aade_password').closest('tr');
            
            if (method === 'aade') {
                $usernameRow.show();
                $passwordRow.show();
            } else {
                $usernameRow.hide();
                $passwordRow.hide();
            }
        },
        
        /**
         * Initialize password toggle (show/hide)
         */
        initPasswordToggle: function() {
            var $passwordField = $('#wcgvi_aade_password');
            
            if ($passwordField.length && $passwordField.attr('type') === 'password') {
                // Check if already wrapped
                if ($passwordField.parent().hasClass('wcgvi-password-wrapper')) {
                    return;
                }
                
                // Wrap field and add toggle button
                var $wrapper = $('<div class="wcgvi-password-wrapper"></div>');
                $passwordField.wrap($wrapper);
                
                var $toggleBtn = $('<button type="button" class="wcgvi-toggle-password" aria-label="Εμφάνιση κωδικού">' +
                    '<span class="dashicons dashicons-visibility"></span>' +
                    '</button>');
                
                $passwordField.after($toggleBtn);
                
                // Toggle password visibility
                $toggleBtn.on('click', function(e) {
                    e.preventDefault();
                    var type = $passwordField.attr('type');
                    var $icon = $(this).find('.dashicons');
                    
                    if (type === 'password') {
                        $passwordField.attr('type', 'text');
                        $icon.removeClass('dashicons-visibility').addClass('dashicons-hidden');
                        $(this).attr('aria-label', 'Απόκρυψη κωδικού');
                    } else {
                        $passwordField.attr('type', 'password');
                        $icon.removeClass('dashicons-hidden').addClass('dashicons-visibility');
                        $(this).attr('aria-label', 'Εμφάνιση κωδικού');
                    }
                });
            }
        },
        
        /**
         * Validate VAT in admin
         */
        validateVAT: function($btn) {
            var orderId = $btn.data('order-id');
            var vatNumber = $('#_billing_vat_number').val();
            var country = $('#_billing_country').val();
            
            if (!vatNumber) {
                alert(wcgvi_admin_params.no_vat_text);
                return;
            }
            
            $btn.prop('disabled', true).text(wcgvi_admin_params.validating_text);
            
            $.ajax({
                url: wcgvi_admin_params.ajax_url,
                type: 'POST',
                data: {
                    action: 'wcgvi_validate_vat',
                    vat_number: vatNumber,
                    country: country,
                    nonce: wcgvi_admin_params.nonce
                },
                success: function(response) {
                    $btn.prop('disabled', false).text(wcgvi_admin_params.validate_text);
                    
                    if (response.success) {
                        alert(wcgvi_admin_params.valid_text + '\n\n' + 
                              (response.data.company_name ? wcgvi_admin_params.company_text + ': ' + response.data.company_name + '\n' : '') +
                              (response.data.doy ? wcgvi_admin_params.doy_text + ': ' + response.data.doy + '\n' : '') +
                              (response.data.activity ? wcgvi_admin_params.activity_text + ': ' + response.data.activity : ''));
                        
                        // Update fields
                        if (response.data.company_name && !$('#_billing_company').val()) {
                            $('#_billing_company').val(response.data.company_name);
                        }
                        if (response.data.doy && !$('#_billing_doy').val()) {
                            $('#_billing_doy').val(response.data.doy);
                        }
                        if (response.data.activity && !$('#_billing_business_activity').val()) {
                            $('#_billing_business_activity').val(response.data.activity);
                        }
                    } else {
                        alert(wcgvi_admin_params.invalid_text + '\n\n' + response.data.message);
                    }
                },
                error: function() {
                    $btn.prop('disabled', false).text(wcgvi_admin_params.validate_text);
                    alert(wcgvi_admin_params.error_text);
                }
            });
        },
        
        /**
         * Regenerate invoice
         */
        regenerateInvoice: function($btn) {
            if (!confirm(wcgvi_admin_params.regenerate_confirm)) {
                return;
            }
            
            var orderId = $btn.data('order-id');
            $btn.prop('disabled', true).text(wcgvi_admin_params.generating_text);
            
            $.ajax({
                url: wcgvi_admin_params.ajax_url,
                type: 'POST',
                data: {
                    action: 'wcgvi_regenerate_invoice',
                    order_id: orderId,
                    nonce: wcgvi_admin_params.nonce
                },
                success: function(response) {
                    $btn.prop('disabled', false).text(wcgvi_admin_params.regenerate_text);
                    
                    if (response.success) {
                        alert(wcgvi_admin_params.success_text);
                        location.reload();
                    } else {
                        alert(wcgvi_admin_params.error_text + '\n\n' + response.data.message);
                    }
                },
                error: function() {
                    $btn.prop('disabled', false).text(wcgvi_admin_params.regenerate_text);
                    alert(wcgvi_admin_params.error_text);
                }
            });
        },
        
        /**
         * Upload invoice
         */
        uploadInvoice: function($btn) {
            var orderId = $btn.data('order-id');
            var $fileInput = $('#wcgvi-invoice-upload-' + orderId);
            
            // Trigger file input click
            $fileInput.off('change').on('change', function() {
                var file = this.files[0];
                
                if (!file) {
                    return;
                }
                
                if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
                    alert('Μόνο PDF αρχεία επιτρέπονται');
                    $(this).val('');
                    return;
                }
                
                // Confirm upload
                if (!confirm('Θέλετε να ανεβάσετε το αρχείο: ' + file.name + '?')) {
                    $(this).val('');
                    return;
                }
                
                var formData = new FormData();
                formData.append('action', 'wcgvi_upload_invoice');
                formData.append('order_id', orderId);
                formData.append('invoice_file', file);
                formData.append('nonce', wcgvi_admin_params.nonce);
                
                $btn.prop('disabled', true).html('<span class="dashicons dashicons-update" style="vertical-align: middle; margin-top: 3px; animation: rotation 1s infinite linear;"></span> Ανέβασμα...');
                
                $.ajax({
                    url: wcgvi_admin_params.ajax_url,
                    type: 'POST',
                    data: formData,
                    processData: false,
                    contentType: false,
                    success: function(response) {
                        $btn.prop('disabled', false).html('<span class="dashicons dashicons-upload" style="vertical-align: middle; margin-top: 3px;"></span> Ανέβασμα PDF');
                        $fileInput.val('');
                        
                        if (response.success) {
                            alert('Το παραστατικό ανέβηκε επιτυχώς!');
                            location.reload();
                        } else {
                            alert('Σφάλμα: ' + (response.data.message || 'Αποτυχία ανεβάσματος'));
                        }
                    },
                    error: function(xhr, status, error) {
                        $btn.prop('disabled', false).html('<span class="dashicons dashicons-upload" style="vertical-align: middle; margin-top: 3px;"></span> Ανέβασμα PDF');
                        $fileInput.val('');
                        alert('Σφάλμα δικτύου: ' + error);
                    }
                });
            }).trigger('click');
        },
        
        /**
         * Test API connection (AADE or VIES)
         */
        testConnection: function($btn) {
            var action = $btn.data('action');
            var $result = $btn.siblings('.wcgvi-test-result');
            var originalText = $btn.text();
            
            // Show loading state
            $btn.prop('disabled', true).text('Δοκιμή...');
            $result.html('<span style="color: #999;">⏳ Αναμονή...</span>');
            
            $.ajax({
                url: wcgvi_admin_params.ajax_url,
                type: 'POST',
                data: {
                    action: action,
                    nonce: wcgvi_admin_params.nonce
                },
                success: function(response) {
                    $btn.prop('disabled', false).text(originalText);
                    
                    if (response.success) {
                        // Check if this is a warning (AADE not available but format OK) or full success
                        var isWarning = response.data.message && response.data.message.indexOf('⚠️') !== -1;
                        var color = isWarning ? '#f57c00' : '#46b450'; // Orange for warning, green for success
                        var icon = isWarning ? '⚠️' : '✓';
                        
                        var message = '<span style="color: ' + color + '; font-weight: bold;">' + icon + ' ' + 
                            (isWarning ? 'Μερική επιτυχία (μόνο format check)' : 'Επιτυχής σύνδεση') + '</span>';
                        
                        if (response.data.company) {
                            message += '<br><small style="color: #555;">' + response.data.company + '</small>';
                        }
                        if (response.data.address) {
                            message += '<br><small style="color: #666; font-size: 11px; max-width: 600px; display: inline-block; word-wrap: break-word;">' + 
                                response.data.address + '</small>';
                        }
                        $result.html(message);
                    } else {
                        var errorMsg = '<span style="color: #dc3232; font-weight: bold;">✗ Αποτυχία σύνδεσης</span>';
                        if (response.data && response.data.message) {
                            errorMsg += '<br><small style="color: #555;">' + response.data.message + '</small>';
                        }
                        $result.html(errorMsg);
                    }
                },
                error: function(xhr, status, error) {
                    $btn.prop('disabled', false).text(originalText);
                    $result.html('<span style="color: #dc3232; font-weight: bold;">✗ Σφάλμα δικτύου</span><br><small style="color: #555;">' + error + '</small>');
                }
            });
        }
    };
    
    // Initialize
    wcgviAdmin.init();
});
