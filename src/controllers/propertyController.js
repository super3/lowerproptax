// In-memory storage for now (replace with database later)
const properties = new Map();

// Test helper to reset storage
export function resetProperties() {
  properties.clear();
}

// Get all properties for the authenticated user
export async function getProperties(req, res) {
  try {
    const userId = req.user.id;
    const userProperties = Array.from(properties.values()).filter(
      property => property.userId === userId
    );
    res.json(userProperties);
  } catch (error) {
    console.error('Error getting properties:', error);
    res.status(500).json({ error: 'Failed to get properties' });
  }
}

// Get a single property by ID
export async function getProperty(req, res) {
  try {
    const { id } = req.params;
    const property = properties.get(id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Ensure user owns this property
    if (property.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(property);
  } catch (error) {
    console.error('Error getting property:', error);
    res.status(500).json({ error: 'Failed to get property' });
  }
}

// Create a new property
export async function createProperty(req, res) {
  try {
    const { address, city, state, zipCode, lat, lng } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const propertyId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newProperty = {
      id: propertyId,
      userId: req.user.id,
      address,
      city: city || '',
      state: state || '',
      zipCode: zipCode || '',
      lat: lat || null,
      lng: lng || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    properties.set(propertyId, newProperty);
    res.status(201).json(newProperty);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(500).json({ error: 'Failed to create property' });
  }
}

// Update a property
export async function updateProperty(req, res) {
  try {
    const { id } = req.params;
    const property = properties.get(id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Ensure user owns this property
    if (property.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { address, city, state, zipCode, lat, lng } = req.body;
    const updatedProperty = {
      ...property,
      address: address !== undefined ? address : property.address,
      city: city !== undefined ? city : property.city,
      state: state !== undefined ? state : property.state,
      zipCode: zipCode !== undefined ? zipCode : property.zipCode,
      lat: lat !== undefined ? lat : property.lat,
      lng: lng !== undefined ? lng : property.lng,
      updatedAt: new Date().toISOString()
    };

    properties.set(id, updatedProperty);
    res.json(updatedProperty);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
}

// Delete a property
export async function deleteProperty(req, res) {
  try {
    const { id } = req.params;
    const property = properties.get(id);

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Ensure user owns this property
    if (property.userId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    properties.delete(id);
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
}
