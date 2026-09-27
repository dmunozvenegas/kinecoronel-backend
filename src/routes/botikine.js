// backend/src/routes/botikine.js
const express = require('express');
const router = express.Router();
const botikineService = require('../services/botikine.service');

// Ruta para procesar el carrito y generar el link de pago
router.post('/checkout', async (req, res) => {
  try {
    const { paciente_id, carrito } = req.body;
    
    if (!paciente_id || !carrito || carrito.length === 0) {
      return res.status(400).json({ error: 'Faltan datos o el carrito está vacío' });
    }

    const resultado = await botikineService.crearOrdenYCheckout(paciente_id, carrito);
    res.status(200).json(resultado);
  } catch (error) {
    console.error('Error en checkout:', error);
    res.status(500).json({ error: 'Error procesando la compra' });
  }
});

// Ruta que MercadoPago llamará automáticamente cuando el cliente pague
router.post('/webhook', async (req, res) => {
  try {
    const { type, topic, 'data.id': dataId } = req.query;
    const action = type || topic;
    const paymentId = dataId || req.query.id;

    await botikineService.procesarWebhook(action, paymentId);
    
    // Siempre hay que responder 200 rápido a MercadoPago
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error procesando webhook');
  }
});

// Obtener todos los productos
router.get('/productos', async (req, res) => {
  try {
    const productos = await botikineService.obtenerProductos();
    res.status(200).json(productos);
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({ error: 'Error al obtener el inventario' });
  }
});

// Crear un nuevo producto
router.post('/productos', async (req, res) => {
  try {
    const nuevoProducto = await botikineService.crearProducto(req.body);
    res.status(201).json(nuevoProducto);
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error al registrar el producto' });
  }
});

// Actualizar un producto existente
router.put('/productos/:id', async (req, res) => {
  try {
    const actualizado = await botikineService.actualizarProducto(req.params.id, req.body);
    if (!actualizado) return res.status(404).json({ error: 'Producto no encontrado' });
    res.status(200).json(actualizado);
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

// Eliminar (desactivar) un producto
router.delete('/productos/:id', async (req, res) => {
  try {
    const desactivado = await botikineService.desactivarProducto(req.params.id);
    if (!desactivado) return res.status(404).json({ error: 'Producto no encontrado' });
    res.status(200).json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({ error: 'Error al eliminar el producto' });
  }
});

module.exports = router;