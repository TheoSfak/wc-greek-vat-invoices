<?php
/**
 * Invoice Generator
 * Generates PDF invoices and receipts with TCPDF
 */

if (!defined('ABSPATH')) {
    exit;
}

class WCGVI_Invoice_Generator {
    
    private static $instance = null;
    
    public static function get_instance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    private function __construct() {
        // Add generate invoice button to admin order page
        add_action('woocommerce_order_actions', array($this, 'add_order_action'));
        add_action('woocommerce_order_action_wcgvi_generate_invoice', array($this, 'generate_invoice_action'));
        
        // Add download link in order admin
        add_action('woocommerce_admin_order_data_after_order_details', array($this, 'add_download_link'));
        
        // Add download link in customer account
        add_filter('woocommerce_my_account_my_orders_actions', array($this, 'add_customer_download_link'), 10, 2);
        
        // AJAX handlers for admin
        add_action('wp_ajax_wcgvi_regenerate_invoice', array($this, 'ajax_regenerate_invoice'));
        add_action('wp_ajax_wcgvi_upload_invoice', array($this, 'ajax_upload_invoice'));
    }
    
    /**
     * AJAX handler for regenerating invoice
     */
    public function ajax_regenerate_invoice() {
        check_ajax_referer('wcgvi_admin_nonce', 'nonce');
        
        if (!current_user_can('edit_shop_orders')) {
            wp_send_json_error(array('message' => __('Δεν έχετε δικαίωμα πρόσβασης', 'wc-greek-vat-invoices')));
        }
        
        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        
        if (!$order_id) {
            wp_send_json_error(array('message' => __('Μη έγκυρο ID παραγγελίας', 'wc-greek-vat-invoices')));
        }
        
        $order = wc_get_order($order_id);
        
        if (!$order) {
            wp_send_json_error(array('message' => __('Η παραγγελία δεν βρέθηκε', 'wc-greek-vat-invoices')));
        }
        
        // Delete old invoice file if exists
        $old_file = $order->get_meta('_invoice_file_path');
        if ($old_file) {
            $upload_dir = wp_upload_dir();
            $old_file_path = $upload_dir['basedir'] . '/wcgvi-invoices/' . $old_file;
            if (file_exists($old_file_path)) {
                unlink($old_file_path);
            }
        }
        
        // Generate new invoice
        $result = $this->generate_pdf($order);
        
        if ($result) {
            $invoice_number = $order->get_meta('_invoice_number');
            wp_send_json_success(array(
                'message' => __('Το παραστατικό αναδημιουργήθηκε επιτυχώς', 'wc-greek-vat-invoices'),
                'invoice_number' => $invoice_number
            ));
        } else {
            wp_send_json_error(array('message' => __('Αποτυχία αναδημιουργίας παραστατικού', 'wc-greek-vat-invoices')));
        }
    }
    
    /**
     * AJAX handler for uploading custom invoice
     */
    public function ajax_upload_invoice() {
        check_ajax_referer('wcgvi_admin_nonce', 'nonce');
        
        if (!current_user_can('edit_shop_orders')) {
            wp_send_json_error(array('message' => __('Δεν έχετε δικαίωμα πρόσβασης', 'wc-greek-vat-invoices')));
        }
        
        $order_id = isset($_POST['order_id']) ? intval($_POST['order_id']) : 0;
        
        if (!$order_id) {
            wp_send_json_error(array('message' => __('Μη έγκυρο ID παραγγελίας', 'wc-greek-vat-invoices')));
        }
        
        $order = wc_get_order($order_id);
        
        if (!$order) {
            wp_send_json_error(array('message' => __('Η παραγγελία δεν βρέθηκε', 'wc-greek-vat-invoices')));
        }
        
        // Check if file was uploaded
        if (!isset($_FILES['invoice_file']) || $_FILES['invoice_file']['error'] !== UPLOAD_ERR_OK) {
            wp_send_json_error(array('message' => __('Δεν επιλέχθηκε αρχείο ή υπήρξε σφάλμα κατά το ανέβασμα', 'wc-greek-vat-invoices')));
        }
        
        $file = $_FILES['invoice_file'];
        
        // Validate file type
        $allowed_types = array('application/pdf', 'application/x-pdf');
        $file_type = wp_check_filetype($file['name']);
        
        if (!in_array($file['type'], $allowed_types) && $file_type['ext'] !== 'pdf') {
            wp_send_json_error(array('message' => __('Μόνο PDF αρχεία επιτρέπονται', 'wc-greek-vat-invoices')));
        }
        
        // Create upload directory
        $upload_dir = wp_upload_dir();
        $invoices_dir = $upload_dir['basedir'] . '/wcgvi-invoices';
        
        if (!file_exists($invoices_dir)) {
            wp_mkdir_p($invoices_dir);
            file_put_contents($invoices_dir . '/.htaccess', 'deny from all');
            file_put_contents($invoices_dir . '/index.php', '<?php // Silence is golden');
        }
        
        // Delete old invoice file if exists
        $old_file = $order->get_meta('_invoice_file_path');
        if ($old_file) {
            $old_file_path = $invoices_dir . '/' . $old_file;
            if (file_exists($old_file_path)) {
                unlink($old_file_path);
            }
        }
        
        // Generate unique filename
        $filename = 'invoice-' . $order_id . '-' . time() . '.pdf';
        $file_path = $invoices_dir . '/' . $filename;
        
        // Move uploaded file
        if (move_uploaded_file($file['tmp_name'], $file_path)) {
            // Update order meta
            $order->update_meta_data('_invoice_file_path', $filename);
            $order->update_meta_data('_invoice_uploaded', 'yes');
            $order->update_meta_data('_invoice_upload_date', current_time('mysql'));
            $order->save();
            
            // Update database
            global $wpdb;
            $table_name = $wpdb->prefix . 'wcgvi_invoices';
            
            $invoice_number = $order->get_meta('_invoice_number');
            $invoice_type = $order->get_meta('_billing_invoice_type') ?: 'receipt';
            
            $wpdb->replace(
                $table_name,
                array(
                    'order_id' => $order_id,
                    'invoice_number' => $invoice_number,
                    'invoice_type' => $invoice_type,
                    'invoice_date' => current_time('mysql'),
                    'file_path' => $filename
                ),
                array('%d', '%s', '%s', '%s', '%s')
            );
            
            wp_send_json_success(array(
                'message' => __('Το παραστατικό ανέβηκε επιτυχώς', 'wc-greek-vat-invoices'),
                'filename' => $filename
            ));
        } else {
            wp_send_json_error(array('message' => __('Αποτυχία μεταφοράς αρχείου', 'wc-greek-vat-invoices')));
        }
    }
    
    /**
     * Add generate invoice action
     */
    public function add_order_action($actions) {
        $actions['wcgvi_generate_invoice'] = __('Δημιουργία Παραστατικού (PDF)', 'wc-greek-vat-invoices');
        return $actions;
    }
    
    /**
     * Generate invoice action handler
     */
    public function generate_invoice_action($order) {
        $this->generate_pdf($order);
    }
    
    /**
     * Generate PDF invoice
     */
    public function generate_pdf($order) {
        if (!$order) {
            return false;
        }
        
        // Load TCPDF
        if (!class_exists('TCPDF')) {
            require_once(ABSPATH . 'wp-includes/class-phpmailer.php');
            // Use WP built-in or include TCPDF library
            // For now, we'll create a simple HTML-based invoice
            return $this->generate_html_invoice($order);
        }
        
        $invoice_type = $order->get_meta('_billing_invoice_type') ?: 'receipt';
        $invoice_number = $order->get_meta('_invoice_number');
        
        if (!$invoice_number) {
            // Generate invoice number if not exists
            WCGVI_Order_Handler::get_instance()->generate_invoice_number($order->get_id());
            $invoice_number = $order->get_meta('_invoice_number');
        }
        
        // Create upload directory
        $upload_dir = wp_upload_dir();
        $invoices_dir = $upload_dir['basedir'] . '/wcgvi-invoices';
        
        if (!file_exists($invoices_dir)) {
            wp_mkdir_p($invoices_dir);
            // Protect directory
            file_put_contents($invoices_dir . '/.htaccess', 'deny from all');
            file_put_contents($invoices_dir . '/index.php', '<?php // Silence is golden');
        }
        
        $filename = 'invoice-' . $order->get_id() . '-' . time() . '.pdf';
        $file_path = $invoices_dir . '/' . $filename;
        
        // Generate HTML content
        $html = $this->get_invoice_html($order, $invoice_type, $invoice_number);
        
        // For now, save as HTML (implement TCPDF conversion later)
        file_put_contents($file_path, $html);
        
        // Save file path to order
        $order->update_meta_data('_invoice_file_path', $filename);
        $order->save();
        
        // Update database
        global $wpdb;
        $table_name = $wpdb->prefix . 'wcgvi_invoices';
        $wpdb->update(
            $table_name,
            array('file_path' => $filename),
            array('order_id' => $order->get_id())
        );
        
        return $file_path;
    }
    
    /**
     * Generate HTML invoice content
     */
    private function get_invoice_html($order, $invoice_type, $invoice_number) {
        $company_name = get_option('wcgvi_company_name', get_bloginfo('name'));
        $company_address = get_option('wcgvi_company_address', '');
        $company_vat = get_option('wcgvi_company_vat', '');
        $company_doy = get_option('wcgvi_company_doy', '');
        
        ob_start();
        ?>
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { margin: 0; font-size: 24px; }
                .info-box { margin: 20px 0; }
                .info-box table { width: 100%; }
                .info-box td { padding: 5px; }
                .items table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .items th { background-color: #f5f5f5; }
                .items td.price { text-align: right; }
                .totals { text-align: right; margin: 20px 0; }
                .totals table { margin-left: auto; }
                .totals td { padding: 5px 15px; }
                .totals .total { font-weight: bold; font-size: 16px; }
                .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1><?php echo esc_html($company_name); ?></h1>
                <p><?php echo esc_html($company_address); ?></p>
                <?php if ($company_vat): ?>
                    <p>ΑΦΜ: <?php echo esc_html($company_vat); ?> | ΔΟΥ: <?php echo esc_html($company_doy); ?></p>
                <?php endif; ?>
                <h2><?php echo $invoice_type === 'invoice' ? 'ΤΙΜΟΛΟΓΙΟ' : 'ΑΠΟΔΕΙΞΗ'; ?></h2>
                <p><strong><?php echo esc_html($invoice_number); ?></strong></p>
                <p><?php echo date_i18n(get_option('date_format'), strtotime($order->get_date_created())); ?></p>
            </div>
            
            <div class="info-box">
                <h3>Στοιχεία Πελάτη</h3>
                <table>
                    <tr>
                        <td><strong>Όνομα:</strong></td>
                        <td><?php echo esc_html($order->get_billing_company() ?: $order->get_billing_first_name() . ' ' . $order->get_billing_last_name()); ?></td>
                    </tr>
                    <?php if ($invoice_type === 'invoice'): ?>
                        <tr>
                            <td><strong>ΑΦΜ:</strong></td>
                            <td><?php echo esc_html($order->get_meta('_billing_vat_number')); ?></td>
                        </tr>
                        <tr>
                            <td><strong>ΔΟΥ:</strong></td>
                            <td><?php echo esc_html($order->get_meta('_billing_doy')); ?></td>
                        </tr>
                        <tr>
                            <td><strong>Δραστηριότητα:</strong></td>
                            <td><?php echo esc_html($order->get_meta('_billing_business_activity')); ?></td>
                        </tr>
                    <?php endif; ?>
                    <tr>
                        <td><strong>Διεύθυνση:</strong></td>
                        <td><?php echo esc_html($order->get_billing_address_1() . ' ' . $order->get_billing_address_2()); ?></td>
                    </tr>
                    <tr>
                        <td><strong>Πόλη:</strong></td>
                        <td><?php echo esc_html($order->get_billing_city() . ' ' . $order->get_billing_postcode()); ?></td>
                    </tr>
                </table>
            </div>
            
            <div class="items">
                <table>
                    <thead>
                        <tr>
                            <th>Προϊόν</th>
                            <th style="width: 80px;">Ποσότητα</th>
                            <th style="width: 100px;" class="price">Τιμή Μον.</th>
                            <th style="width: 100px;" class="price">Σύνολο</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($order->get_items() as $item): ?>
                            <tr>
                                <td><?php echo esc_html($item->get_name()); ?></td>
                                <td><?php echo esc_html($item->get_quantity()); ?></td>
                                <td class="price"><?php echo wc_price($item->get_total() / $item->get_quantity()); ?></td>
                                <td class="price"><?php echo wc_price($item->get_total()); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            
            <div class="totals">
                <table>
                    <tr>
                        <td>Υποσύνολο:</td>
                        <td><?php echo wc_price($order->get_subtotal()); ?></td>
                    </tr>
                    <?php if ($order->get_shipping_total() > 0): ?>
                        <tr>
                            <td>Μεταφορικά:</td>
                            <td><?php echo wc_price($order->get_shipping_total()); ?></td>
                        </tr>
                    <?php endif; ?>
                    <?php if ($order->get_total_tax() > 0): ?>
                        <tr>
                            <td>ΦΠΑ (<?php echo $order->get_tax_totals()[0]->rate ?? '24'; ?>%):</td>
                            <td><?php echo wc_price($order->get_total_tax()); ?></td>
                        </tr>
                    <?php else: ?>
                        <?php $exempt_reason = $order->get_meta('_vat_exempt_reason'); ?>
                        <?php if ($exempt_reason): ?>
                            <tr>
                                <td colspan="2" style="font-size: 10px;"><?php echo esc_html($exempt_reason); ?></td>
                            </tr>
                        <?php endif; ?>
                    <?php endif; ?>
                    <tr class="total">
                        <td>ΣΥΝΟΛΟ:</td>
                        <td><?php echo wc_price($order->get_total()); ?></td>
                    </tr>
                </table>
            </div>
            
            <div class="footer">
                <p>Σας ευχαριστούμε για την προτίμησή σας!</p>
                <p>Παραγγελία #<?php echo esc_html($order->get_order_number()); ?></p>
            </div>
        </body>
        </html>
        <?php
        return ob_get_clean();
    }
    
    /**
     * Generate simple HTML invoice (fallback)
     */
    private function generate_html_invoice($order) {
        return $this->generate_pdf($order);
    }
    
    /**
     * Add download link in admin
     */
    public function add_download_link($order) {
        $invoice_number = $order->get_meta('_invoice_number');
        $file_path = $order->get_meta('_invoice_file_path');
        $order_id = $order->get_id();
        
        echo '<div class="wcgvi-admin-invoice-section" style="margin: 20px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd;">';
        echo '<h4>' . __('Παραστατικό', 'wc-greek-vat-invoices') . '</h4>';
        
        if ($invoice_number) {
            echo '<p><strong>' . __('Αριθμός:', 'wc-greek-vat-invoices') . '</strong> ' . esc_html($invoice_number) . '</p>';
        }
        
        echo '<p class="wcgvi-admin-buttons">';
        
        // Download button
        if ($file_path) {
            $upload_dir = wp_upload_dir();
            $file_url = $upload_dir['baseurl'] . '/wcgvi-invoices/' . $file_path;
            echo '<a href="' . esc_url($file_url) . '" class="button button-primary" target="_blank" style="margin-right: 10px;">';
            echo '<span class="dashicons dashicons-download" style="vertical-align: middle; margin-top: 3px;"></span> ';
            echo __('Λήψη Παραστατικού', 'wc-greek-vat-invoices') . '</a>';
        }
        
        // Regenerate button
        echo '<button type="button" class="button wcgvi-regenerate-invoice" data-order-id="' . esc_attr($order_id) . '" style="margin-right: 10px;">';
        echo '<span class="dashicons dashicons-update" style="vertical-align: middle; margin-top: 3px;"></span> ';
        echo __('Αναδημιουργία', 'wc-greek-vat-invoices') . '</button>';
        
        // Upload button
        echo '<button type="button" class="button wcgvi-upload-invoice-btn" data-order-id="' . esc_attr($order_id) . '">';
        echo '<span class="dashicons dashicons-upload" style="vertical-align: middle; margin-top: 3px;"></span> ';
        echo __('Ανέβασμα PDF', 'wc-greek-vat-invoices') . '</button>';
        
        echo '</p>';
        
        // Hidden file input for upload
        echo '<input type="file" id="wcgvi-invoice-upload-' . esc_attr($order_id) . '" accept=".pdf" style="display:none;" />';
        
        echo '</div>';
    }
    
    /**
     * Add download link in customer account
     */
    public function add_customer_download_link($actions, $order) {
        $file_path = $order->get_meta('_invoice_file_path');
        
        if ($file_path) {
            $upload_dir = wp_upload_dir();
            $file_url = $upload_dir['baseurl'] . '/wcgvi-invoices/' . $file_path;
            
            $actions['download_invoice'] = array(
                'url' => $file_url,
                'name' => __('Λήψη Παραστατικού', 'wc-greek-vat-invoices')
            );
        }
        
        return $actions;
    }
}
