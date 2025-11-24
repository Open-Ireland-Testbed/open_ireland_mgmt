import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Button, Alert } from '@tcdona/ui';

const CATEGORY_OPTIONS = [
    { value: 'OPTICAL', label: 'Optical' },
    { value: 'COMPUTE', label: 'Compute' },
    { value: 'STORAGE', label: 'Storage' },
    { value: 'INFRA', label: 'Infrastructure' },
];

export default function DeviceTypeForm({
    mode = 'create',
    initialValues = null,
    onSubmit,
    onCancel,
    isSubmitting = false,
}) {
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        description: '',
        is_schedulable: false,
        has_ports: false,
    });

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    useEffect(() => {
        if (initialValues && mode === 'edit') {
            setFormData({
                name: initialValues.name || '',
                category: initialValues.category || '',
                description: initialValues.description || '',
                is_schedulable: initialValues.is_schedulable || false,
                has_ports: initialValues.has_ports || false,
            });
        }
    }, [initialValues, mode]);

    const validateField = (name, value) => {
        switch (name) {
            case 'name':
                return !value || value.trim() === '' ? 'Name is required' : null;
            case 'category':
                return !value || value === '' ? 'Category is required' : null;
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

    const handleChange = (name, value) => {
        const processedValue = typeof value === 'string' ? value.trim() : value;
        setFormData((prev) => ({ ...prev, [name]: processedValue }));
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

    const handleSubmit = (e) => {
        e.preventDefault();
        const allTouched = {};
        Object.keys(formData).forEach((key) => {
            allTouched[key] = true;
        });
        setTouched(allTouched);

        if (!validateForm()) {
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const element = document.querySelector(`[name="${firstErrorField}"]`);
                if (element) element.focus();
            }
            return;
        }

        const payload = {
            name: formData.name,
            category: formData.category,
            description: formData.description || null,
            is_schedulable: formData.is_schedulable,
            has_ports: formData.has_ports,
        };

        onSubmit(payload);
    };

    const hasErrors = Object.keys(errors).length > 0;
    const showErrors = Object.keys(touched).length > 0 && hasErrors;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {showErrors && <Alert type="error">Please fix the errors below before submitting.</Alert>}

            <Card title="Device Type Information">
                <div className="space-y-4">
                    <Input
                        label="Name *"
                        name="name"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        onBlur={() => handleBlur('name')}
                        error={touched.name ? errors.name : null}
                        placeholder="e.g., EDFA, ROADM, Server"
                        required
                    />
                    <Select
                        label="Category *"
                        name="category"
                        value={formData.category}
                        onChange={(e) => handleChange('category', e.target.value)}
                        onBlur={() => handleBlur('category')}
                        options={CATEGORY_OPTIONS}
                        error={touched.category ? errors.category : null}
                        placeholder="Select category"
                        required
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Description
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            rows={3}
                            className="block w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 focus:outline-none resize-y"
                            placeholder="Optional description"
                        />
                    </div>
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_schedulable}
                                onChange={(e) => handleChange('is_schedulable', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Schedulable</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.has_ports}
                                onChange={(e) => handleChange('has_ports', e.target.checked)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Has Ports</span>
                        </label>
                    </div>
                </div>
            </Card>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting || hasErrors} loading={isSubmitting}>
                    {mode === 'create' ? 'Create Device Type' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
}

