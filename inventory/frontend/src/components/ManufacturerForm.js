import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Alert } from '@tcdona/ui';

const URL_REGEX = /^https?:\/\/.+/;

function validateURL(url) {
    if (!url) return null;
    return URL_REGEX.test(url) ? null : 'Website must be a valid URL starting with http:// or https://';
}

export default function ManufacturerForm({
    mode = 'create',
    initialValues = null,
    onSubmit,
    onCancel,
    isSubmitting = false,
}) {
    const [formData, setFormData] = useState({
        name: '',
        website: '',
        notes: '',
    });

    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    useEffect(() => {
        if (initialValues && mode === 'edit') {
            setFormData({
                name: initialValues.name || '',
                website: initialValues.website || '',
                notes: initialValues.notes || '',
            });
        }
    }, [initialValues, mode]);

    const validateField = (name, value) => {
        switch (name) {
            case 'name':
                return !value || value.trim() === '' ? 'Name is required' : null;
            case 'website':
                return validateURL(value);
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
            website: formData.website || null,
            notes: formData.notes || null,
        };

        onSubmit(payload);
    };

    const hasErrors = Object.keys(errors).length > 0;
    const showErrors = Object.keys(touched).length > 0 && hasErrors;

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {showErrors && <Alert type="error">Please fix the errors below before submitting.</Alert>}

            <Card title="Manufacturer Information">
                <div className="space-y-4">
                    <Input
                        label="Name *"
                        name="name"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        onBlur={() => handleBlur('name')}
                        error={touched.name ? errors.name : null}
                        placeholder="e.g., Ciena, Juniper, Cisco"
                        required
                    />
                    <Input
                        label="Website"
                        name="website"
                        type="url"
                        value={formData.website}
                        onChange={(e) => handleChange('website', e.target.value)}
                        onBlur={() => handleBlur('website')}
                        error={touched.website ? errors.website : null}
                        placeholder="https://example.com"
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={(e) => handleChange('notes', e.target.value)}
                            rows={3}
                            className="block w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-700 focus:border-blue-500 focus:ring-blue-500 focus:outline-none resize-y"
                            placeholder="Optional notes"
                        />
                    </div>
                </div>
            </Card>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSubmitting || hasErrors} loading={isSubmitting}>
                    {mode === 'create' ? 'Create Manufacturer' : 'Save Changes'}
                </Button>
            </div>
        </form>
    );
}

