const db = require('../config/db');
const crypto = require('crypto');
const redis = require('../config/redis');  // Redis client

const formatServiceData = (service) => {
  if (service.features) {
    service.features = JSON.parse(service.features);
  }
  if (service.details) {
    service.details = JSON.parse(service.details);
  }
  return service;
};

exports.createService = async (req, res) => {
  try {
    const { name, price, category, status = 'Available', features = null, details = null } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({ message: 'Name, price, and category are required' });
    }

    // Stringify the features and details arrays before saving
    const featuresStr = features ? JSON.stringify(features) : null;
    const detailsStr = details ? JSON.stringify(details) : null;

    const id = crypto.randomBytes(8).toString('hex');

    await redis.del('services');

    const serviceObject = {
      id,
      name,
      price,
      category,
      status,
      features: featuresStr,
      details: detailsStr
    };

    await db.query(
      'INSERT INTO Service (id, name, price, category, status, features, details) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, price, category, status, featuresStr, detailsStr]
    );

    // Clear cache for service categories
    await redis.del('service_categories');
    await redis.del(`services_${category}`);

    const formattedService = formatServiceData(serviceObject);
    res.status(201).json(formattedService);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create service' });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const cachedServices = await redis.get('services');
    if (cachedServices) {
      return res.status(200).json(JSON.parse(cachedServices));
    }
    const [services] = await db.query('SELECT * FROM Service');

    services.forEach(service => formatServiceData(service));
    await redis.set('services', JSON.stringify(services), 'EX', 3600);  // Cache for 1 hour

    res.status(200).json(services);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch services' });
  }
};

exports.getServicesByCategory = async (req, res) => {
  try{
    const { category } = req.params;
    if (!category) {
      return res.status(400).json({ message: 'Category is required' });
    }
    // Check if we have cached services for this category
    const cachedServices = await redis.get(`services_${category}`);
    if (cachedServices) {
      return res.status(200).json(JSON.parse(cachedServices));
    }
    const [services] = await db.query('SELECT * FROM Service WHERE category = ?', [category]);
    if (services.length === 0) {
      return res.status(404).json({ message: 'No services found for this category' });
    }
    services.forEach(service => formatServiceData(service));

    // Cache the services for this category
    await redis.set(`services_${category}`, JSON.stringify(services), 'EX', 24*7*3600);  // Cache for 1 hour
    res.status(200).json(services);
  }catch(err){
    res.status(500).json({ message: err.message });
  }
}

exports.getAllServiceCategories = async (req, res) => {
  try {
    console.log('Fetching all service categories');
    // Check cached categories first
    const cachedCategories = await redis.get('service_categories');
    if (cachedCategories) {
      return res.status(200).json(JSON.parse(cachedCategories));
    }
    // Fetch distinct categories from DB
    const [categories] = await db.query('SELECT DISTINCT category FROM Service');

    if (categories.length === 0) {
      return res.status(404).json({ message: 'No categories found' });
    }

    // Map to array of strings
    const categoryList = categories.map(row => row.category);

    // Cache result
    await redis.set('service_categories', JSON.stringify(categoryList), 'EX', 24*7*3600);

    // Return array of strings
    res.status(200).json(categoryList);
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: 'Service ID is required' });
      }

      // Check if we have cached service by ID
      const cachedService = await redis.get(`service_${id}`);
      if (cachedService) {
        return res.status(200).json(JSON.parse(cachedService));
      }
      const [service] = await db.query('SELECT * FROM Service WHERE id = ?', [id]);
      if (service.length === 0) {
        return res.status(404).json({ message: 'Service not found' });
      }
      const formattedService = formatServiceData(service[0]);

      // Cache the service for future use
      await redis.set(`service_${id}`, JSON.stringify(formattedService), 'EX', 3600);  // Cache for 1 hour
      res.status(200).json(formattedService);

    } catch (err) {
    res.status(500).json({ message: err.message });

  }
};

exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id || !updates) {
      return res.status(400).json({ message: 'Service ID and data are required' });
    }

    // Check if we have cached service by ID
    const cachedService = await redis.get(`service_${id}`);
    const existingService = Null;
    if (cachedService) {
      existingService = JSON.parse(cachedService);
    }else{
      const [service] = await db.query('SELECT * FROM Service WHERE id = ?', [id]);
      if (service.length === 0) {
        return res.status(404).json({ message: 'Service not found' });
      }
      existingService = service[0];
    }
    // Stringify features and details arrays if provided
    if (updates.features) {
      updates.features = JSON.stringify(updates.features);
    }
    if (updates.details) {
      updates.details = JSON.stringify(updates.details);
    }

    const fields = Object.keys(updates);
    const values = Object.values(updates);

    const setClause = fields.map(field => `${field} = ?`).join(', ');

    await db.query(`UPDATE Service SET ${setClause} WHERE id = ?`, [...values, id]);

    // Clear the cache for the service by id and service by category and service categories
    await redis.del(`service_${id}`);
    await redis.del(`services_${existingService.category}`);
    await redis.del('service_categories');
    const [updatedService] = await db.query('SELECT * FROM Service WHERE id = ?', [id]);
    const formattedService = formatServiceData(updatedService[0]);
    res.status(200).json(formattedService);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update service' });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Service ID is required' });
    }

    // Check if we have cached service by ID
    const cachedService = await redis.get(`service_${id}`);
    const existingService = Null;
    if (cachedService) {
      existingService = JSON.parse(cachedService);
    }else{
      const [service] = await db.query('SELECT * FROM Service WHERE id = ?', [id]);
      if (service.length === 0) {
        return res.status(404).json({ message: 'Service not found' });
      }
      existingService = service[0];
    }

    await db.query('DELETE FROM Service WHERE id = ?', [id]);

    // Clear the cache for the service by id and service by category and service categories
    await redis.del(`service_${id}`);
    await redis.del(`services_${existingService.category}`);
    await redis.del('service_categories');
    res.status(200).json({ message: 'Service deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete service' });
  }
};
