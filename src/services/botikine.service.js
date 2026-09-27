// backend/src/services/botikine.service.js
const pool = require('../db'); // Importamos tu conexión a la base de datos existente
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Configuración de MercadoPago (Asegúrate de tener MP_ACCESS_TOKEN en tu archivo .env)
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

const crearOrdenYCheckout = async (paciente_id, carrito) => {
  // carrito = [{ producto_id, nombre, cantidad, precio_unitario }]
  const clientDb = await pool.connect();

  try {
    await clientDb.query('BEGIN');

    // 1. Calcular total
    const total = carrito.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad), 0);

    // 2. Insertar Orden en la BD
    const insertOrdenQuery = `
      INSERT INTO ordenes (paciente_id, total, estado) 
      VALUES ($1, $2, 'pendiente') RETURNING id
    `;
    const ordenResult = await clientDb.query(insertOrdenQuery, [paciente_id, total]);
    const ordenId = ordenResult.rows[0].id;

    // 3. Insertar Detalles del carrito
    for (const item of carrito) {
      await clientDb.query(`
        INSERT INTO orden_detalles (orden_id, producto_id, cantidad, precio_unitario) 
        VALUES ($1, $2, $3, $4)
      `, [ordenId, item.producto_id, item.cantidad, item.precio_unitario]);
    }

    // 4. Crear Preferencia en MercadoPago
    const preference = new Preference(client);
    
    const itemsMP = carrito.map(item => ({
      id: item.producto_id,
      title: item.nombre,
      quantity: item.cantidad,
      unit_price: item.precio_unitario,
      currency_id: 'CLP'
    }));

    const result = await preference.create({
      body: {
        items: itemsMP,
        external_reference: ordenId, // Vinculamos el pago con el ID de tu BD
        back_urls: {
          success: process.env.FRONTEND_URL + '/botikine/exito',
          failure: process.env.FRONTEND_URL + '/botikine/error',
        },
        auto_return: 'approved',
        // La URL donde MercadoPago avisará que se pagó (debe ser tu dominio en Render)
        notification_url: process.env.BACKEND_URL + '/api/botikine/webhook' 
      }
    });

    await clientDb.query('COMMIT');

    return { 
      orden_id: ordenId, 
      init_point: result.init_point // Link de pago
    };

  } catch (error) {
    await clientDb.query('ROLLBACK');
    throw error; // Lanzamos el error para que el controlador (ruta) lo atrape
  } finally {
    clientDb.release();
  }
};

const procesarWebhook = async (action, paymentId) => {
  if (action === 'payment' && paymentId) {
    const payment = new Payment(client);
    const paymentData = await payment.get({ id: paymentId });

    if (paymentData.status === 'approved') {
      const ordenId = paymentData.external_reference; 

      // Actualizamos el estado en tu PostgreSQL
      await pool.query(`
        UPDATE ordenes 
        SET estado = 'pagada', mercadopago_id = $1 
        WHERE id = $2 AND estado = 'pendiente'
      `, [paymentId, ordenId]);

      // (Opcional) Aquí puedes agregar la query para descontar el stock de la tabla productos
      return ordenId;
    }
  }
  return null;
};

const obtenerProductos = async () => {
  // Traemos los productos activos ordenados alfabéticamente
  const clientDb = await pool.connect();
  try {
    const result = await clientDb.query('SELECT * FROM productos WHERE activo = TRUE ORDER BY nombre ASC');
    return result.rows;
  } finally {
    clientDb.release();
  }
};

const crearProducto = async (producto) => {
  const { nombre, descripcion, precio, stock, categoria, imagen_url } = producto;
  const clientDb = await pool.connect();
  try {
    const result = await clientDb.query(
      `INSERT INTO productos (nombre, descripcion, precio, stock, categoria, imagen_url) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [nombre, descripcion, precio, stock, categoria, imagen_url]
    );
    return result.rows[0];
  } finally {
    clientDb.release();
  }
};

const actualizarProducto = async (id, producto) => {
  const { nombre, descripcion, precio, stock, categoria, imagen_url } = producto;
  const clientDb = await pool.connect();
  try {
    const result = await clientDb.query(
      `UPDATE productos 
       SET nombre = $1, descripcion = $2, precio = $3, stock = $4, categoria = $5, imagen_url = $6
       WHERE id = $7 RETURNING *`,
      [nombre, descripcion, precio, stock, categoria, imagen_url, id]
    );
    return result.rows[0];
  } finally {
    clientDb.release();
  }
};

const desactivarProducto = async (id) => {
  const clientDb = await pool.connect();
  try {
    // Borrado lógico: Cambiamos a inactivo para no romper el historial de compras
    const result = await clientDb.query(
      `UPDATE productos SET activo = FALSE WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0];
  } finally {
    clientDb.release();
  }
};

module.exports = { 
  crearOrdenYCheckout, 
  procesarWebhook, 
  obtenerProductos, 
  crearProducto, 
  actualizarProducto, 
  desactivarProducto 
}; 