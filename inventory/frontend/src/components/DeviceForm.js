import React, { useState, useEffect, useMemo } from 'react';
import { Card, Input, Select, Button, Alert } from '@tcdona/ui';
import { useDeviceTypes, useManufacturers, useSites } from '../hooks/useInventoryData';

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'in_maintenance', label: 'In Maintenance' },
    { value: 'retired', label: 'Retired' },
    { value: 'spare', label: 'Spare' },
    { value: 'planned', label: 'Planned' },
];

// Simple IP validation regex
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function validateIP(ip) {
    if (!ip) return null; // Optional field
    return IP_REGEX.test(ip) ? null : 'Invalid IP address format';
}

function generateExampleOiId() {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `OI-DEV-${random}`;
}

export default function DeviceForm({
    mode = 'create',
    initialValues = null,
    onSubmit,
    onCancel,
    isSubmitting = false,
    title,
    submitLabel,
}) {
    const { data: deviceTypes } = useDeviceTypes();
    const { data: manufacturers } = useManufacturers();
    const { data: sites } = useSites();

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        oi_id: '',
        device_type_id: '',
        manufacturer_id: '',
        model: '',
        serial_number: '',
        status: 'active',
        site_id: '',
        rack: '',
        u_position: '',
        hostname: '',
        mgmt_ip: '',
        polatis_name: '',
        polatis_port_range: '',
        owner_group: '',
        notes: '',
    });

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Initialize form from initialValues (for edit mode)
    useEffect(() => {
        if (initialValues && mode === 'edit') {
            setFormData({
                name: initialValues.name || '',
                oi_id: initialValues.oi_id || '',
                device_type_id: initialValues.device_type_id || initialValues.device_type?.id || '',
                manufacturer_id: initialValues.manufacturer_id || initialValues.manufacturer?.id || '',
                model: initialValues.model || '',
                serial_number: initialValues.serial_number || '',
                status: initialValues.status || 'active',
                site_id: initialValues.site_id || initialValues.site?.id || '',
                rack: initialValues.rack || '',
                u_position: initialValues.u_position !== null && initialValues.u_position !== undefined ? String(initialValues.u_position) : '',
                hostname: initialValues.hostname || '',
                mgmt_ip: initialValues.mgmt_ip || '',
                polatis_name: initialValues.polatis_name || '',
                polatis_port_range: initialValues.polatis_port_range || '',
                owner_group: initialValues.owner_group || '',
                notes: initialValues.notes || '',
            });
        }
    }, [initialValues, mode]);

    // Prepare dropdown options
    const deviceTypeOptions = useMemo(() => {
        if (!deviceTypes) return [];
        return deviceTypes.map((dt) => ({ value: String(dt.id), label: dt.name }));
    }, [deviceTypes]);

    const manufacturerOptions = useMemo(() => {
        const options = [{ value: '', label: 'None' }];
        if (manufacturers) {
            manufacturers.forEach((m) => {
                options.push({ value: String(m.id), label: m.name });
            });
        }
        return options;
    }, [manufacturers]);

    const siteOptions = useMemo(() => {
        const options = [{ value: '', label: 'None' }];
        if (sites) {
            sites.forEach((s) => {
                options.push({ value: String(s.id), label: s.name });
            });
        }
        return options;
    }, [sites]);

    // Validation
    const validateField = (name, value) => {
        switch (name) {
            case 'name':
                return !value || value.trim() === '' ? 'Name is required' : null;
            case 'device_type_id':
                return !value || value === '' ? 'Device type is required' : null;
            case 'status':
                return !value || value === '' ? 'Status is required' : null;
            case 'u_position':
                if (value && value.trim() !== '') {
                    const num = parseInt(value, 10);
                    if (isNaN(num) || num < 0) {
                        return 'U position must be a non-negative integer';
                    }
                }
                return null;
            case 'mgmt_ip':
                return validateIP(value);
            default:
                return null;
        }
    };

    const validateForm = () => {
        const newErrors = {};
        Object.keys(formData).forEach((key) => {
            const error = validateField(key, formData[key]);
            if (error) {
                newErrors[key] = error;
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Handle field changes
    const handleChange = (name, value) => {
        // Trim whitespace for text fields
        const processedValue = typeof value === 'string' && name !== 'notes' ? value.trim() : value;

        setFormData((prev) => ({ ...prev, [name]: processedValue }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const handleBlur = (name) => {
        setTouched((prev) => ({ ...prev, [name]: true }));
        const error = validateField(name, formData[name]);
        if (error) {
            setErrors((prev) => ({ ...prev, [name]: error }));
        }
    };

    // Handle form submission
    const handleSubmit = (e) => {
        e.preventDefault();

        // Mark all fields as touched
        const allTouched = {};
        Object.keys(formData).forEach((key) => {
            allTouched[key] = true;
        });
        setTouched(allTouched);

        if (!validateForm()) {
            // Focus first error field
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const element = document.querySelector(`[name="${firstErrorField}"]`);
                if (element) {
                    element.focus();
                }
            }
            return;
        }

        // Prepare payload - convert empty strings to null/undefined and convert IDs to integers
        const payload = {};
        Object.entries(formData).forEach(([key, value]) => {
            // Convert ID fields to integers or null
            if (key.endsWith('_id')) {
                if (value === '' || value === null || value === undefined) {
                    payload[key] = null;
                } else {
                    payload[key] = parseInt(value, 10);
                }
            } else if (key === 'u_position') {
                if (value === '' || value === null || value === undefined) {
                    payload[key] = null;
                } else {
                    payload[key] = parseInt(value, 10);
                }
            } else {
                // For text fields, convert empty strings to null for optional fields
                if (value === '' || value === null || value === undefined) {
                    // Required fields should not be empty (validation already caught this)
                    if (['name', 'status'].includes(key)) {
                        payload[key] = value; // Will be caught by validation
                    } else {
                        payload[key] = null;
                    }
                } else {
                    payload[key] = value;
                }
            }
        });

        // For create mode, ensure required fields are present
        if (mode === 'create') {
            if (!payload.name || !payload.device_type_id) {
                return;
            }
        }

        onSubmit(payload);
    };

    const handleGenerateOiId = () => {
        const exampleId = generateExampleOiId();
        handleChange('oi_id', exampleId);
    };

    const formTitle = title || (mode === 'create' ? 'Add Device' : 'Edit Device');
    const formSubmitLabel = submitLabel || (mode === 'create' ? 'Create Device' : 'Save Changes');

    const hasErrors = Object.keys(errors).length > 0;
    const showErrors = Object.keys(touched).length > 0 && hasErrors;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {showErrors && (
                <Alert type="error">
                    Please fix the errors below before submitting.
                </Alert>
            )}

            {/* Basic Information */}
            <Card title="Basic Information">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="Name *"
                            name="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            onBlur={() => handleBlur('name')}
                            error={touched.name ? errors.name : null}
                            placeholder="Device name"
                            required
                        />
                    </div>
                    <div>
                        <div className="flex items-end gap-2">
                            <div className="flex-1">
                                <Input
                                    label="OI ID"
                                    name="oi_id"
                                    value={formData.oi_id}
                                    onChange={(e) => handleChange('oi_id', e.target.value)}
                                    placeholder="OI-DEV-000123"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleGenerateOiId}
                                title="Generate example OI ID"
                            >
                                Generate
                            </Button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Optional. Suggested format: OI-DEV-000123
                        </p>
                    </div>
                    <div>
                        <Select
                            label="Device Type *"
                            name="device_type_id"
                            value={formData.device_type_id}
                            onChange={(e) => handleChange('device_type_id', e.target.value)}
                            onBlur={() => handleBlur('device_type_id')}
                            options={deviceTypeOptions}
                            error={touched.device_type_id ? errors.device_type_id : null}
                            placeholder="Select device type"
                            required
                        />
                    </div>
                    <div>
                        <Select
                            label="Manufacturer"
                            name="manufacturer_id"
                            value={formData.manufacturer_id}
                            onChange={(e) => handleChange('manufacturer_id', e.target.value)}
                            options={manufacturerOptions}
                            placeholder="Select manufacturer"
                        />
                    </div>
                    <div>
                        <Input
                            label="Model"
                            name="model"
                            value={formData.model}
                            onChange={(e) => handleChange('model', e.target.value)}
                            placeholder="Device model"
                        />
                    </div>
                    <div>
                        <Input
                            label="Serial Number"
                            name="serial_number"
                            value={formData.serial_number}
                            onChange={(e) => handleChange('serial_number', e.target.value)}
                            placeholder="Serial number"
                        />
                    </div>
                </div>
            </Card>

            {/* Status & Location */}
            <Card title="Status & Location">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Select
                            label="Status *"
                            name="status"
                            value={formData.status}
                            onChange={(e) => handleChange('status', e.target.value)}
                            onBlur={() => handleBlur('status')}
                            options={STATUS_OPTIONS}
                            error={touched.status ? errors.status : null}
                            required
                        />
                    </div>
                    <div>
                        <Input
                            label="Owner Group"
                            name="owner_group"
                            value={formData.owner_group}
                            onChange={(e) => handleChange('owner_group', e.target.value)}
                            placeholder="Owner group"
                        />
                    </div>
                    <div>
                        <Select
                            label="Site"
                            name="site_id"
                            value={formData.site_id}
                            onChange={(e) => handleChange('site_id', e.target.value)}
                            options={siteOptions}
                            placeholder="Select site"
                        />
                    </div>
                    <div>
                        <Input
                            label="Rack"
                            name="rack"
                            value={formData.rack}
                            onChange={(e) => handleChange('rack', e.target.value)}
                            placeholder="Rack identifier"
                        />
                    </div>
                    <div>
                        <Input
                            label="U Position"
                            name="u_position"
                            type="number"
                            min="0"
                            value={formData.u_position}
                            onChange={(e) => handleChange('u_position', e.target.value)}
                            onBlur={() => handleBlur('u_position')}
                            error={touched.u_position ? errors.u_position : null}
                            placeholder="U position"
                        />
                    </div>
                </div>
            </Card>

            {/* Network */}
            <Card title="Network">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="Hostname"
                            name="hostname"
                            value={formData.hostname}
                            onChange={(e) => handleChange('hostname', e.target.value)}
                            placeholder="hostname.example.com"
                        />
                    </div>
                    <div>
                        <Input
                            label="Management IP"
                            name="mgmt_ip"
                            value={formData.mgmt_ip}
                            onChange={(e) => handleChange('mgmt_ip', e.target.value)}
                            onBlur={() => handleBlur('mgmt_ip')}
                            error={touched.mgmt_ip ? errors.mgmt_ip : null}
                            placeholder="192.168.1.1"
                        />
                    </div>
                </div>
            </Card>

            {/* Polatis */}
            <Card title="Polatis">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Input
                            label="Polatis Name"
                            name="polatis_name"
                            value={formData.polatis_name}
                            onChange={(e) => handleChange('polatis_name', e.target.value)}
                            placeholder="Polatis name"
                        />
                    </div>
                    <div>
                        <Input
                            label="Polatis Port Range"
                            name="polatis_port_range"
                            value={formData.polatis_port_range}
                            onChange={(e) => handleChange('polatis_port_range', e.target.value)}
                            placeholder="e.g., 1-10"
                        />
                    </div>
                </div>
            </Card>

            {/* Notes */}
            <Card title="Notes">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Notes
                    </label>
                    <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                        rows={4}
                        className="block w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 focus:outline-none resize-y"
                        placeholder="Additional notes about this device..."
                    />
                </div>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || hasErrors}
                    loading={isSubmitting}
                >
                    {formSubmitLabel}
                </Button>
            </div>
        </form>
    );
}

