const unsafeText = /[<>]/;

export const validateAddressField = (field, rawValue) => {
  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
  switch (field) {
    case 'name':
      if (!value) return 'Full name is required.';
      if (value.length < 2) return 'Full name must contain at least 2 characters.';
      if (value.length > 100) return 'Full name cannot exceed 100 characters.';
      if (unsafeText.test(value)) return 'Full name contains invalid characters.';
      return '';
    case 'phone':
      if (!value) return 'Phone number is required.';
      if (!/^[6-9]\d{9}$/.test(value)) return 'Enter a valid 10-digit Indian mobile number.';
      return '';
    case 'pincode':
      if (!value) return 'Pincode is required.';
      if (!/^[1-9]\d{5}$/.test(value)) return 'Enter a valid 6-digit pincode.';
      return '';
    case 'address_line1':
      if (!value) return 'House, building, and street are required.';
      if (value.length < 3) return 'Address line 1 must contain at least 3 characters.';
      if (value.length > 250) return 'Address line 1 cannot exceed 250 characters.';
      if (unsafeText.test(value)) return 'Address line 1 contains invalid characters.';
      return '';
    case 'address_line2':
      if (value && value.length > 250) return 'Address line 2 cannot exceed 250 characters.';
      if (value && unsafeText.test(value)) return 'Address line 2 contains invalid characters.';
      return '';
    case 'city':
    case 'state': {
      const label = field === 'city' ? 'City' : 'State';
      if (!value) return `${label} is required.`;
      if (value.length < 2) return `${label} must contain at least 2 characters.`;
      if (value.length > 100) return `${label} cannot exceed 100 characters.`;
      if (unsafeText.test(value)) return `${label} contains invalid characters.`;
      return '';
    }
    case 'landmark':
      if (value && value.length > 150) return 'Landmark cannot exceed 150 characters.';
      if (value && unsafeText.test(value)) return 'Landmark contains invalid characters.';
      return '';
    case 'address_type':
      return ['home', 'work', 'other'].includes(value) ? '' : 'Select a valid address type.';
    default:
      return '';
  }
};

export const validateAddress = (address) => {
  const fields = ['name', 'phone', 'pincode', 'address_line1', 'address_line2', 'city', 'state', 'landmark', 'address_type'];
  return fields.reduce((errors, field) => {
    const error = validateAddressField(field, address[field]);
    if (error) errors[field] = error;
    return errors;
  }, {});
};

export const cleanAddress = (address) => ({
  ...address,
  name: address.name.trim(),
  phone: address.phone.trim(),
  pincode: address.pincode.trim(),
  address_line1: address.address_line1.trim(),
  address_line2: address.address_line2.trim() || null,
  city: address.city.trim(),
  state: address.state.trim(),
  landmark: address.landmark.trim() || null,
});
