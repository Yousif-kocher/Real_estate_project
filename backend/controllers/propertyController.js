const db = require('../config/database');

const createProperty = (req, res) => {
  const {
    block_name,
    property_type,
    coordinates,
    measures,
    bedrooms,
    bathrooms,
    kitchens,
    description,
    price
  } = req.body;

  const video_path = req.file ? req.file.filename : null;
  const user_id = req.user.id; // From auth middleware

  db.query(
    `INSERT INTO properties 
     (user_id, block_name, property_type, coordinates, measures, bedrooms, bathrooms, kitchens, description, video_path, price) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, block_name, property_type, coordinates, measures, bedrooms, bathrooms, kitchens, description, video_path, price],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Property created successfully', propertyId: results.insertId });
    }
  );
};

const getProperties = (req, res) => {
  const { block, type } = req.query;
  let query = `SELECT p.*, u.fullname, u.photo as user_photo 
               FROM properties p 
               JOIN users u ON p.user_id = u.id 
               WHERE 1=1`;
  let params = [];

  if (block) {
    query += ' AND p.block_name = ?';
    params.push(block);
  }

  if (type) {
    query += ' AND p.property_type = ?';
    params.push(type);
  }

  query += ' ORDER BY p.created_at DESC LIMIT 20';

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

const getRecentProperties = (req, res) => {
  db.query(
    `SELECT p.*, u.fullname, u.photo as user_photo 
     FROM properties p 
     JOIN users u ON p.user_id = u.id 
     ORDER BY p.created_at DESC 
     LIMIT 10`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
};
const deleteProperty = (req, res) => {
    const propertyId = req.params.id;
    const userId = req.user.id;

    // First check if the property exists and belongs to the user
    db.query('SELECT * FROM properties WHERE id = ?', [propertyId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Property not found' });
        
        const property = results[0];
        if (property.user_id !== userId) {
            return res.status(403).json({ error: 'You can only delete your own properties' });
        }

        // Delete the property
        db.query('DELETE FROM properties WHERE id = ?', [propertyId], (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Property deleted successfully' });
        });
    });
};

module.exports = { createProperty, getProperties, getRecentProperties, deleteProperty };
