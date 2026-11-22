var test = require('node:test');
var assert = require('node:assert/strict');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice uses the same coupon, HSN GST, and billed total figures as checkout', function () {
  var items = [{ id: 4, name: 'Bulk rice', hsn: '1006', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(figures.subtotal, billed.subtotal);
  assert.equal(figures.discount, billed.discount);
  assert.equal(figures.tax, billed.tax);
  assert.equal(figures.cgst, billed.cgst);
  assert.equal(figures.sgst, billed.sgst);
  assert.equal(figures.total, billed.total);
});

test('invoice follows the checkout HSN slab when the order line has no gstRate', function () {
  var items = [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var order = {
    id: 17,
    items: items,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, 105);
});

test('invoice treats a decimal gstRate the same way checkout does', function () {
  var items = [{ id: 2, name: 'Oil', hsn: '1512', price: 100, qty: 1, gstRate: 0.05 }];
  var billed = pricing.computeTotals(items, '');
  var order = { items: items, subtotal: billed.subtotal, tax: billed.tax, total: billed.total };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(billed.tax, 5);
  assert.equal(billed.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.total, 105);
});

test('invoice coupon figures match capped checkout discount and post-discount GST', function () {
  var items = [{ id: 3, name: 'Bulk goods', hsn: '1006', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = {
    id: 18,
    date: '2026-11-22',
    customer: 'In-memory customer',
    items: items,
    coupon: 'SAVE10',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  };
  var figures = invoice.computeInvoiceFigures(order);
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 92.5);
  assert.equal(figures.total, 1942.5);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].delta, 0);
  assert.equal(reconciliation.rows[0].matched, true);

  var html = invoice.render(order);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /₹1942\.50/);
});
