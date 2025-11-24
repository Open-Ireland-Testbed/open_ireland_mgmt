import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Alert, Tag } from '@tcdona/ui';

const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

function validateColor(color) {
  if (!color) return null;
  return HEX_COLOR_REGEX.test(color) ? null : 'Color must be a valid hex color (e.g., #FF5722 or #F52)';
}

export default function TagForm({
  mode = 'create',
  initialValues = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '',
  });

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    if (initialValues && mode === 'edit') {
      setFormData({
        name: initialValues.name || '',
        description: initialValues.description || '',
        color: initialValues.color || '',
      });
    }
  }, [initialValues, mode]);

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        return !value || value.trim() === '' ? 'Name is required' : null;
      case 'color':
        return validateColor(value);
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
      description: formData.description || null,
      color: formData.color || null,
    };

    onSubmit(payload);
  };

  const hasErrors = Object.keys(errors).length > 0;
  const showErrors = Object.keys(touched).length > 0 && hasErrors;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {showErrors && <Alert type="error">Please fix the errors below before submitting.</Alert>}

      <Card title="Tag Information">
        <div className="space-y-4">
          <Input
            label="Name *"
            name="name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            error={touched.name ? errors.name : null}
            placeholder="e.g., Production, Test, Maintenance"
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
          <div>
            <Input
              label="Color"
              name="color"
              value={formData.color}
              onChange={(e) => handleChange('color', e.target.value)}
              onBlur={() => handleBlur('color')}
              error={touched.color ? errors.color : null}
              placeholder="#FF5722"
            />
            {formData.color && HEX_COLOR_REGEX.test(formData.color) && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Preview:</span>
                <Tag color={formData.color}>{formData.name || 'Tag'}</Tag>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional hex color (e.g., #FF5722 or #F52)
            </p>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting || hasErrors} loading={isSubmitting}>
          {mode === 'create' ? 'Create Tag' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

