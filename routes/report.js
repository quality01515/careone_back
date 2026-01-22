const express = require('express');
const router = express.Router();
const path = require('path');
const puppeteer = require('puppeteer');
const { get_menus } = require('../models/menu');
const { get_patient_profile, get_patient_header_info } = require('../models/patient');
const { userAuth } = require('../middlewares/auth');
const { renderReportHTML } = require('../views/reportTemplate');

// Utility: group components by category (re-usable with menu route)
function groupByCategory(categories) {
  const categoryMap = new Map();
  categories.forEach((item) => {
    if (!categoryMap.has(item.PortalCategories_ID)) {
      categoryMap.set(item.PortalCategories_ID, {
        PortalCategories_ID: item.PortalCategories_ID,
        PortalCategoriesName: item.PortalCategoriesName,
        PortalCategoriesLongName: item.PortalCategoriesLongDescription,
        PortalCategoriesDescription: item.PortalCategoriesDescription,
        PortalCategoriesURL: item.PortalCategoriesURL,
        components: [],
      });
    }
    const category = categoryMap.get(item.PortalCategories_ID);
    category.components.push({
      PortalComponents_ID: item.PortalComponents_ID,
      PortalComponentsName: item.PortalComponentsName,
      PortalComponentsDescription: item.PortalComponentsDescription,
      ExternalLink: item.ExternalLink,
      Hidden: item.Hidden == 0 ? 0 : 1,
    });
  });
  return [...categoryMap.values()];
}

// GET /api/report/preview?patient_id=123
router.get('/preview', userAuth, async (req, res, next) => {
  try {
    const patient_id = req.query.patient_id ? parseInt(req.query.patient_id, 10) : (req.user && req.user.patient_id);
    if (!patient_id) return res.status(400).send('patient_id is required');

    const [menus, patient, header_info] = await Promise.all([
      get_menus(patient_id),
      get_patient_profile(patient_id),
      get_patient_header_info(patient_id),
    ]);

    const categories = groupByCategory(menus.recordset || []);

    const html = renderReportHTML({
      patient,
      categories,
      generatedAt: new Date(),
      header_info,
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// GET /api/report/pdf?patient_id=123
router.get('/pdf', userAuth, async (req, res, next) => {
  try {
    const patient_id = req.query.patient_id ? parseInt(req.query.patient_id, 10) : (req.user && req.user.patient_id);
    console.log("Generating PDF for patient_id:", patient_id);
    if (!patient_id) return res.status(400).send('patient_id is required');

    const [menus, patient, header_info] = await Promise.all([
      get_menus(patient_id),
      get_patient_profile(patient_id),
      get_patient_header_info(patient_id),
    ]);

    const categories = groupByCategory(menus.recordset || []);

    // Build HTML and convert to PDF
    const html = renderReportHTML({ patient, categories, generatedAt: new Date(), header_info });

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      await browser.close();

      const filename = `Patient_Journey_Report_${patient_id}.pdf`;
      const inline = req.query.inline === '1' || req.query.inline === 'true';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${filename}"`);
      return res.send(pdfBuffer);
    } catch (e) {
      try { await browser.close(); } catch (_) {}
      return next(e);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
