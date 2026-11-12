(function () {
  const form = document.querySelector('form[data-order-form]');
  if (!form) return;

  const dataNode = document.getElementById('order-data');
  const body = form.querySelector('[data-line-body]');
  const template = document.getElementById('line-row-template');
  const addButton = form.querySelector('[data-add-line]');
  if (!dataNode || !body || !template) return;

  let payload = { products: [] };
  try {
    payload = JSON.parse(dataNode.textContent || '{}');
  } catch (error) {
    payload = { products: [] };
  }

  const productMap = new Map();
  (payload.products || []).forEach(function (product) {
    productMap.set(String(product.id), product);
  });

  const numberFormatter = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  function rupiah(value) {
    return 'Rp ' + numberFormatter.format(Number(value) || 0);
  }

  function rows() {
    return Array.prototype.slice.call(body.querySelectorAll('tr.line-row'));
  }

  function rowValue(row, selector) {
    const field = row.querySelector(selector);
    return field ? field.value.trim() : '';
  }

  function lineTotal(row) {
    const quantity = Number(rowValue(row, '.line-quantity')) || 0;
    const price = Number(rowValue(row, '.line-price')) || 0;
    if (quantity <= 0 || price < 0) return 0;
    return Math.round(quantity * price * 100) / 100;
  }

  function updateMeta(row) {
    const product = productMap.get(rowValue(row, '.line-product'));
    const meta = row.querySelector('.line-meta');
    if (!meta) return;

    if (!product) {
      meta.textContent = '';
      return;
    }

    meta.textContent =
      'Available: ' + numberFormatter.format(product.available) + ' ' + (product.unit || '');
  }

  function updateRow(row) {
    const totalCell = row.querySelector('.line-total');
    if (totalCell) totalCell.textContent = rupiah(lineTotal(row));
    updateMeta(row);
  }

  function updateTotals() {
    let subtotal = 0;
    let units = 0;
    let lines = 0;

    rows().forEach(function (row) {
      if (!rowValue(row, '.line-product')) return;
      const quantity = Number(rowValue(row, '.line-quantity')) || 0;
      lines += 1;
      units += quantity;
      subtotal += lineTotal(row);
    });

    subtotal = Math.round(subtotal * 100) / 100;

    const setText = function (selector, value) {
      const node = form.querySelector(selector);
      if (node) node.textContent = value;
    };

    setText('[data-summary-lines]', String(lines));
    setText('[data-summary-units]', numberFormatter.format(units));
    setText('[data-summary-subtotal]', rupiah(subtotal));
    setText('[data-summary-total]', rupiah(subtotal));
    setText('[data-order-total]', rupiah(subtotal));
  }

  function applyProduct(row, forcePrice) {
    const select = row.querySelector('.line-product');
    const priceField = row.querySelector('.line-price');
    const quantityField = row.querySelector('.line-quantity');
    const product = productMap.get(select ? select.value : '');

    if (!product) {
      updateRow(row);
      updateTotals();
      return;
    }

    if (priceField && (forcePrice || priceField.value === '')) {
      priceField.value = String(product.unitPrice);
    }
    if (quantityField && quantityField.value === '') {
      quantityField.value = '1';
    }

    updateRow(row);
    updateTotals();
  }

  function addRow() {
    const fragment = template.content.cloneNode(true);
    const row = fragment.querySelector('tr.line-row');
    if (!row) return;

    body.appendChild(fragment);
    updateRow(row);
    updateTotals();

    const select = row.querySelector('.line-product');
    if (select) select.focus();
  }

  function removeRow(row) {
    if (rows().length <= 1) {
      const select = row.querySelector('.line-product');
      const quantity = row.querySelector('.line-quantity');
      const price = row.querySelector('.line-price');
      if (select) select.value = '';
      if (quantity) quantity.value = '';
      if (price) price.value = '';
      updateRow(row);
      updateTotals();
      return;
    }

    row.remove();
    updateTotals();
  }

  body.addEventListener('change', function (event) {
    const select = event.target.closest('.line-product');
    if (!select) return;
    applyProduct(select.closest('tr.line-row'), true);
  });

  body.addEventListener('input', function (event) {
    const row = event.target.closest('tr.line-row');
    if (!row) return;
    if (!event.target.matches('.line-quantity, .line-price')) return;
    updateRow(row);
    updateTotals();
  });

  body.addEventListener('click', function (event) {
    const remove = event.target.closest('.line-remove');
    if (!remove) return;
    removeRow(remove.closest('tr.line-row'));
  });

  if (addButton) {
    addButton.addEventListener('click', addRow);
  }

  rows().forEach(function (row) {
    const select = row.querySelector('.line-product');
    if (select && select.value && rowValue(row, '.line-price') === '') {
      applyProduct(row, false);
    } else {
      updateRow(row);
    }
  });

  updateTotals();
})();
