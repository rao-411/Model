// Professional English/Thai translation dictionary for the VT Garment Sourcing Optimization Dashboard
export type Language = "EN" | "TH";

const translations: Record<string, Record<Language, string>> = {
  // Header
  "VT Garment Sourcing Optimization Engine": {
    EN: "VT Garment Sourcing Optimization Engine",
    TH: "ระบบจัดการเพิ่มประสิทธิภาพการจัดซื้อ VT Garment"
  },
  "Sourcing Optimization Engine": {
    EN: "Sourcing Optimization Engine",
    TH: "ระบบคำนวณและวางแผนจัดส่ง"
  },
  "Multi-Scenario Slicing, Container Optimization, Cumulative Rounding & MOQ Push-back Decision Support Dashboard": {
    EN: "Multi-Scenario Slicing, Container Optimization, Cumulative Rounding & MOQ Push-back Decision Support Dashboard",
    TH: "แดชบอร์ดสนับสนุนการตัดสินใจ: การแยกกลุ่มสถานการณ์, การเพิ่มประสิทธิภาพตู้คอนเทนเนอร์, การปัดเศษสะสม และการเลื่อนกำหนดการเพื่อรับ MOQ"
  },
  "Time": {
    EN: "Time",
    TH: "เวลา"
  },
  "Port: VT Garment (Inbound)": {
    EN: "Port: VT Garment (Inbound)",
    TH: "ท่าเรือ: VT Garment (ขาเข้า)"
  },
  "V3.2 Engine": {
    EN: "V3.2 Engine",
    TH: "เครื่องมือคำนวณเวอร์ชัน V3.2"
  },

  // Step Sidebar
  "Where you are": {
    EN: "Where you are",
    TH: "ตอนนี้อยู่ขั้นตอนไหน"
  },
  "Upload manifest": {
    EN: "Upload manifest",
    TH: "อัปโหลดไฟล์ PR"
  },
  "Load your Syteline PR sheet": {
    EN: "Load your Syteline PR sheet",
    TH: "ใส่ไฟล์ PR จาก Syteline"
  },
  "Set rates & quotes": {
    EN: "Set rates & quotes",
    TH: "ตั้งอัตราต้นทุนและราคาค่าส่ง"
  },
  "Carrying rate, freight, MOQ, currency": {
    EN: "Carrying rate, freight, MOQ, currency",
    TH: "ต้นทุนเก็บสต๊อก ค่าส่ง ขั้นต่ำสั่ง อัตราแลกเปลี่ยน"
  },
  "Compare scenarios": {
    EN: "Compare scenarios",
    TH: "เทียบแต่ละทางเลือก"
  },
  "Cost of each shipping option": {
    EN: "Cost of each shipping option",
    TH: "ต้นทุนของแต่ละแผนการส่ง"
  },
  "Review warnings & export": {
    EN: "Review warnings & export",
    TH: "ตรวจสอบจุดที่ต้องแก้ และออกใบสั่งซื้อ"
  },
  "Review & export": {
    EN: "Review & export",
    TH: "ตรวจสอบผลลัพธ์และออกใบสั่งซื้อ"
  },
  "Fix flags, get the requisition": {
    EN: "Fix flags, get the requisition",
    TH: "แก้จุดที่ถูกตีธง แล้วรับใบขอซื้อ"
  },
  "Get the requisition & line output": {
    EN: "Get the requisition & line output",
    TH: "รับใบขอซื้อและรายการ Line"
  },

  // PrUploader
  "No Inbound Manifest Loaded": {
    EN: "No Inbound Manifest Loaded",
    TH: "ยังไม่มีการโหลดเอกสารจัดซื้อขาเข้า"
  },
  "Welcome to the VT Garment Optimization Engine. Drop your Syteline procurement sheets or load our preconfigured sample dataset to start slicing logistics scenarios.": {
    EN: "Welcome to the VT Garment Optimization Engine. Drop your Syteline procurement sheets or load our preconfigured sample dataset to start slicing logistics scenarios.",
    TH: "ยินดีต้อนรับสู่โปรแกรมประมวลผลโลจิสติกส์การจัดสั่งซื้อของ VT Garment โปรดลากไฟล์ตารางแผนงานจัดซื้อของ Syteline หรือโหลดข้อมูลตัวอย่างสำเร็จเพื่อเริ่มเปรียบเทียบสถานการณ์รอบการจัดส่งสินค้า"
  },
  "Get Started with VT Garment Sample Data": {
    EN: "Get Started with VT Garment Sample Data",
    TH: "เริ่มใช้งานด้วยข้อมูลตัวอย่างของ VT Garment"
  },
  "Inbound Material Manifest": {
    EN: "Inbound Material Manifest",
    TH: "รายการรหัสสินค้าจัดซื้อขาเข้า"
  },
  "Upload custom PR spreadsheet or drag & drop. Supports Syteline standard column formats.": {
    EN: "Upload custom PR spreadsheet or drag & drop. Supports Syteline standard column formats.",
    TH: "อัปโหลดสเปรดชีต PR หรือลากและวาง รองรับรูปแบบคอลัมน์มาตรฐานของ Syteline"
  },
  "Drop the spreadsheet file here...": {
    EN: "Drop the spreadsheet file here...",
    TH: "วางไฟล์สเปรดชีตของคุณที่นี่..."
  },
  "Select Files": {
    EN: "Select Files",
    TH: "เลือกไฟล์เอกสาร"
  },

  // Logistics Config
  "Logistics Configuration": {
    EN: "Logistics Configuration",
    TH: "การกำหนดค่าพารามิเตอร์โลจิสติกส์"
  },
  "Set holding rates, MCQ defaults, routes, and pull-forward parameters.": {
    EN: "Set holding rates, MCQ defaults, routes, and pull-forward parameters.",
    TH: "ตั้งค่าอัตราการจัดเก็บสินค้า, เกณฑ์ MCQ เริ่มต้น, เส้นทางเรือ และพารามิเตอร์สิทธิพิเศษ"
  },
  "Inventory Carrying Rate (Per Annum)": {
    EN: "Inventory Carrying Rate (Per Annum)",
    TH: "อัตราต้นทุนจัดเก็บสินค้าคงคลัง (ต่อปี)"
  },
  "Capital Opportunity Cost (WACC)": {
    EN: "Capital Opportunity Cost (WACC)",
    TH: "อัตราต้นทุนค่าเสียโอกาสของเงินทุน (WACC)"
  },
  "Default MCQ MCQ Threshold (YD)": {
    EN: "Default MCQ MCQ Threshold (YD)",
    TH: "เกณฑ์ขั้นต่ำ MCQ MCQ เริ่มต้น (หลา)"
  },
  "Ship From Port (Origin)": {
    EN: "Ship From Port (Origin)",
    TH: "ท่าเรือส่งออกต้นทาง (Origin)"
  },
  "Transit Time": {
    EN: "Transit Time",
    TH: "ระยะเวลาขนส่งเรือ (วัน)"
  },
  "Enable Pull-Forward MOQ MCQ Push": {
    EN: "Enable Pull-Forward MOQ MCQ Push",
    TH: "เปิดใช้การดึงจัดส่งเร็วขึ้นเพื่อข้ามเกณฑ์ MCQ"
  },
  "Pulls later PR items to earlier shipments if sub-threshold MCQ is found, preventing surcharges.": {
    EN: "Pulls later PR items to earlier shipments if sub-threshold MCQ is found, preventing surcharges.",
    TH: "ดึงรายการ PR สัปดาห์หลังๆ มารวมส่งในตู้วีคแรก หากปริมาณสีกระทบเกณฑ์ต่ำกว่า MCQ เพื่อเลี่ยงค่าปรับ"
  },
  "Prefer 20ft FCL for October Surcharge": {
    EN: "Prefer 20ft FCL for October Surcharge",
    TH: "เลือกใช้ตู้ 20ft FCL สำหรับค่าปรับเดือนตุลาคม"
  },
  "Forces October shipments into a 20ft GP container instead of LCL if they exceed MCQ limits.": {
    EN: "Forces October shipments into a 20ft GP container instead of LCL if they exceed MCQ limits.",
    TH: "บังคับให้การจัดส่งรอบเดือนตุลาคมใช้ตู้ 20ft GP แทนการส่งแบบเศษตู้ (LCL) เพื่อป้องกันสินค้าขาด"
  },

  // Advanced Procurement Settings
  "Advanced Procurement Settings": {
    EN: "Advanced Procurement Settings",
    TH: "การกำหนดค่าการจัดซื้อจัดจ้างขั้นสูง"
  },
  "Ship Dates": {
    EN: "Ship Dates",
    TH: "วันเดินเรือ"
  },
  "Quotes": {
    EN: "Quotes",
    TH: "ใบเสนอราคา"
  },
  "Rent": {
    EN: "Rent",
    TH: "ค่าเช่าคลัง"
  },
  "Excess": {
    EN: "Excess",
    TH: "ส่วนเกิน MCQ"
  },
  "Loading": {
    EN: "Loading",
    TH: "วันโหลดเรือ"
  },

  // Scenario Overview
  "Container & Logistics Scenario Slices": {
    EN: "Container & Logistics Scenario Slices",
    TH: "กลุ่มสถานการณ์และการวางแผนตู้คอนเทนเนอร์"
  },
  "Ship From & Incoterm": {
    EN: "Ship From & Incoterm",
    TH: "ต้นทางจัดส่ง & Incoterm"
  },
  "Incoterm Conflict Detected:": {
    EN: "Incoterm Conflict Detected:",
    TH: "ตรวจพบ Incoterm ที่ขัดแย้งกัน:"
  },
  "The uploaded PR file lists more than one Incoterm for the same vendor/origin — only the first value found is being applied. Review and correct in Advanced Procurement Settings \u2192 Incoterms if this is not intentional.": {
    EN: "The uploaded PR file lists more than one Incoterm for the same vendor/origin — only the first value found is being applied. Review and correct in Advanced Procurement Settings \u2192 Incoterms if this is not intentional.",
    TH: "ไฟล์ PR ที่อัปโหลดระบุ Incoterm มากกว่าหนึ่งค่าสำหรับผู้ขาย/ต้นทางเดียวกัน ระบบใช้เฉพาะค่าแรกที่พบเท่านั้น กรุณาตรวจสอบและแก้ไขที่การตั้งค่าจัดซื้อขั้นสูง \u2192 Incoterms หากไม่ใช่ความตั้งใจ"
  },
  "Scenario Cost Breakdown Analysis (THB)": {
    EN: "Scenario Cost Breakdown Analysis (THB)",
    TH: "การวิเคราะห์รายละเอียดต้นทุนในแต่ละสถานการณ์ (THB)"
  },
  "Scenario Cost Breakdown Analysis (Excluding Material Cost) (THB)": {
    EN: "Scenario Cost Breakdown Analysis (Excluding Material Cost) (THB)",
    TH: "การวิเคราะห์รายละเอียดต้นทุนในแต่ละสถานการณ์ (ไม่รวมค่าวัตถุดิบ) (THB)"
  },
  "VT Garment Multi-Scenario Sourcing Ledger": {
    EN: "VT Garment Multi-Scenario Sourcing Ledger",
    TH: "บัญชีเปรียบเทียบการจัดซื้อของแต่ละสถานการณ์ VT Garment"
  },
  "Best Price": {
    EN: "Best Price",
    TH: "ราคาดีที่สุด"
  },
  "Containers Required": {
    EN: "Containers Required",
    TH: "ความต้องการตู้คอนเทนเนอร์"
  },
  "Landed Cost": {
    EN: "Landed Cost",
    TH: "ต้นทุนแลนเดด"
  },
  "Total Vol": {
    EN: "Total Vol",
    TH: "ปริมาตรรวม"
  },

  // Table Columns
  "Scenario": {
    EN: "Scenario",
    TH: "สถานการณ์"
  },
  "Active Weeks": {
    EN: "Active Weeks",
    TH: "สัปดาห์เดินเรือ"
  },
  "Total Qty": {
    EN: "Total Qty",
    TH: "จำนวนรวม (หลา)"
  },
  "Volume (CBM)": {
    EN: "Volume (CBM)",
    TH: "ปริมาตร (CBM)"
  },
  "Material": {
    EN: "Material",
    TH: "ค่าวัตถุดิบ"
  },
  "Freight": {
    EN: "Freight",
    TH: "ค่าระวาง (Freight)"
  },
  "Local": {
    EN: "Local",
    TH: "ค่าท่าเรือ (Local)"
  },
  "Brokerage": {
    EN: "Brokerage",
    TH: "ค่าเดินพิธีการ (Broker)"
  },
  "Shipping": {
    EN: "Shipping",
    TH: "ค่าส่งรวม"
  },
  "Carrying": {
    EN: "Carrying",
    TH: "ค่าจัดเก็บ"
  },
  "Opportunity": {
    EN: "Opportunity",
    TH: "ค่าเสียโอกาสทุน"
  },
  "Surcharges (MOQ/MCQ+Rnd)": {
    EN: "Surcharges (MOQ/MCQ+Rnd)",
    TH: "ค่าปรับและการปัดเศษ"
  },
  "True Landed Cost": {
    EN: "True Landed Cost",
    TH: "ต้นทุนรวมสุดท้าย"
  },
  "Diff vs Scen 1": {
    EN: "Diff vs Scen 1",
    TH: "ผลต่างจากสถานการณ์ที่ 1"
  },
  "Containers Used": {
    EN: "Containers Used",
    TH: "ตู้คอนเทนเนอร์"
  },
  "Status": {
    EN: "Status",
    TH: "สถานะ"
  },

  // Scenario Inspector
  "Scenario Detailed Breakdown": {
    EN: "Scenario Detailed Breakdown",
    TH: "รายละเอียดเจาะลึกสถานการณ์"
  },
  "Grouped by Colors Summary": {
    EN: "Grouped by Colors Summary",
    TH: "สรุปรายการจัดซื้อแยกตามรหัสสี"
  },
  "MCQ Shipment Calendar Matrix": {
    EN: "MCQ Shipment Calendar Matrix",
    TH: "ตารางสรุปเกณฑ์ขั้นต่ำ MCQ ประจำแต่ละรอบจัดส่ง"
  },
  "Item Description (Optional)": {
    EN: "Item Description (Optional)",
    TH: "รายละเอียดสินค้า (ไม่บังคับ)"
  },
  "Shipment": {
    EN: "Shipment",
    TH: "ชิปเมนต์"
  },
  "Shipment Containers & Bins": {
    EN: "Shipment Containers & Bins",
    TH: "ตู้คอนเทนเนอร์และรอบจัดส่งรายสัปดาห์"
  },
  "Shipments & Packing Grid": {
    EN: "Shipments & Packing Grid",
    TH: "รายละเอียดตู้สินค้าและการบรรจุ"
  },
  "Consolidated Materials View": {
    EN: "Consolidated Materials View",
    TH: "มุมมองวัสดุรวม"
  },
  "Duplicated PR Rounded Ledger": {
    EN: "Duplicated PR Rounded Ledger",
    TH: "บัญชีรายละเอียดใบขอซื้อปัดเศษ"
  },
  "Syteline Requisition Output": {
    EN: "Syteline Requisition Output",
    TH: "รายงานผลลัพธ์ใบขอซื้อเข้าระบบ Syteline"
  },
  "Approved": {
    EN: "Approved",
    TH: "อนุมัติแล้ว"
  },
  "Overloaded": {
    EN: "Overloaded",
    TH: "น้ำหนักเกินเกณฑ์"
  },
  "Overdue": {
    EN: "Overdue",
    TH: "ส่งมอบล่าช้า"
  },
  "Flagged": {
    EN: "Flagged",
    TH: "ติดธงแจ้งเตือน"
  },
  "How this matrix works:": {
    EN: "How this matrix works:",
    TH: "หลักการทำงานของตารางเมทริกซ์นี้:"
  },
  "All Syteline entries are grouped by color code and shipment date. If a color's total quantity falls below the MCQ threshold (e.g., 500 YD), that column's shipment is automatically highlighted and the quantity is either moved earlier (consolidated to previous week) or met with a week 1 rounding surcharge to avoid factory minimum penalties.": {
    EN: "All Syteline entries are grouped by color code and shipment date. If a color's total quantity falls below the MCQ threshold (e.g., 500 YD), that column's shipment is automatically highlighted and the quantity is either moved earlier (consolidated to previous week) or met with a week 1 rounding surcharge to avoid factory minimum penalties.",
    TH: "รายการทั้งหมดจาก Syteline จะถูกจัดกลุ่มตามรหัสสีและวันที่ขนส่ง หากปริมาณรวมของสีใดสีหนึ่งต่ำกว่าเกณฑ์ขั้นต่ำ MCQ (เช่น 500 หลา) การจัดส่งในรอบนั้นจะถูกไฮไลต์โดยอัตโนมัติ และระบบจะดึงปริมาณดังกล่าวให้จัดส่งเร็วขึ้น (รวมในสัปดาห์ก่อนหน้า) หรือปัดเศษเพิ่มในรอบแรกพร้อมคิดค่าธรรมเนียมส่วนต่างเพื่อหลีกเลี่ยงค่าปรับยอดสั่งซื้อขั้นต่ำจากโรงงาน"
  },
  "Primary Input Grouping:": {
    EN: "Primary Input Grouping:",
    TH: "การจัดกลุ่มอินพุตหลัก:"
  },
  "This table groups the entire input dataset by unique colors to show the total ordered quantity, CBM, and material cost of each color before split allocations.": {
    EN: "This table groups the entire input dataset by unique colors to show the total ordered quantity, CBM, and material cost of each color before split allocations.",
    TH: "ตารางนี้จะจัดกลุ่มชุดข้อมูลนำเข้าทั้งหมดตามรหัสสี เพื่อแสดงปริมาณการสั่งซื้อทั้งหมด, ปริมาตรตู้ (CBM) และต้นทุนวัสดุของแต่ละสีก่อนการปันส่วนการจัดส่ง"
  },
  "Logistics & Cost Config": {
    EN: "Logistics & Cost Config",
    TH: "การตั้งค่าพารามิเตอร์โลจิสติกส์และต้นทุน"
  },
  "Selected Inbound Shipment Origin": {
    EN: "Selected Inbound Shipment Origin",
    TH: "เลือกต้นทางสำหรับการจัดส่งขาเข้า"
  },
  "The origin determines the pricing formulas (FCL/LCL, base brokerage, and local port dues) applied to each shipment.": {
    EN: "The origin determines the pricing formulas (FCL/LCL, base brokerage, and local port dues) applied to each shipment.",
    TH: "ต้นทางจะเป็นตัวกำหนดสูตรการคำนวณราคา (FCL/LCL, ค่าพิธีการศุลกากร และค่าธรรมเนียมท่าเรือท้องถิ่น) ที่ใช้ในแต่ละรอบจัดส่ง"
  },
  "Annual Inventory Carrying Rate": {
    EN: "Annual Inventory Carrying Rate",
    TH: "อัตราค่าใช้จ่ายการจัดเก็บสินค้าคงคลังรายปี"
  },
  "Used as: (Value ÷ 2) × Rate × (Days Early / 365)": {
    EN: "Used as: (Value ÷ 2) × Rate × (Days Early / 365)",
    TH: "สูตรคำนวณ: (มูลค่าสินค้า ÷ 2) × อัตรา × (จำนวนวันจัดส่งเร็วขึ้น / 365)"
  },
  "Capital Opportunity Rate (WACC)": {
    EN: "Capital Opportunity Rate (WACC)",
    TH: "อัตราต้นทุนค่าเสียโอกาสของเงินทุน (WACC)"
  },
  "Used as: Value × [ (1 + Rate)^(Days Early / 365) − 1 ]": {
    EN: "Used as: Value × [ (1 + Rate)^(Days Early / 365) − 1 ]",
    TH: "สูตรคำนวณ: มูลค่าสินค้า × [ (1 + อัตรา)^(จำนวนวันจัดส่งเร็วขึ้น / 365) − 1 ]"
  },
  "Default Color MOQ / MCQ": {
    EN: "Default Color MOQ / MCQ",
    TH: "ค่าเริ่มต้นเกณฑ์ขั้นต่ำ MCQ/MOQ"
  },
  "Previously Existing Containers": {
    EN: "Previously Existing Containers",
    TH: "ตู้คอนเทนเนอร์ที่มีอยู่เดิม"
  },
  "Enter the number of containers already on hand or already committed. The planner will reduce the additional container requirement for this scenario accordingly.": {
    EN: "Enter the number of containers already on hand or already committed. The planner will reduce the additional container requirement for this scenario accordingly.",
    TH: "ใส่จำนวนตู้คอนเทนเนอร์ที่มีอยู่แล้วหรือได้รับการยืนยันไว้แล้ว ระบบจะลดความต้องการตู้เพิ่มเติมสำหรับสถานการณ์นี้ให้สอดคล้องกัน"
  },
  "Enable MCQ Pull-Forwards": {
    EN: "Enable MCQ Pull-Forwards",
    TH: "เปิดใช้งานระบบดึงจัดส่งเพื่อผ่านเกณฑ์ MCQ"
  },
  "Automatically consolidates color rolls from later weeks into earlier shipments to resolve MOQ gaps (removes leftover quantities from source weeks).": {
    EN: "Automatically consolidates color rolls from later weeks into earlier shipments to resolve MOQ gaps (removes leftover quantities from source weeks).",
    TH: "รวมม้วนผ้าสีจากสัปดาห์ถัดๆ ไปเข้ากับรอบจัดส่งที่เร็วกว่าโดยอัตโนมัติ เพื่อแก้ปัญหายอดสั่งซื้อต่ำกว่าเกณฑ์ขั้นต่ำ MCQ (ลบปริมาณคงเหลือในสัปดาห์ต้นทางออก)"
  },
  "Route Transit Settings (Days)": {
    EN: "Route Transit Settings (Days)",
    TH: "การตั้งค่าระยะเวลาขนส่งของแต่ละเส้นทาง (วัน)"
  },
  "Automatic Recalculation:": {
    EN: "Automatic Recalculation:",
    TH: "การคำนวณใหม่อัตโนมัติ:"
  },
  "Updating values or transit days immediately recalculates all sub-scenarios, container schedules, and capital carrying costs!": {
    EN: "Updating values or transit days immediately recalculates all sub-scenarios, container schedules, and capital carrying costs!",
    TH: "การปรับปรุงค่าพารามิเตอร์หรือจำนวนวันเดินเรือจะคำนวณผลลัพธ์พารามิเตอร์ แผนตู้สินค้า และต้นทุนค่าเสียโอกาสทุนใหม่ทันที!"
  },
  "Auto-extracted from the uploaded manifest (Order Minimum). Editable.": {
    EN: "Auto-extracted from the uploaded manifest (Order Minimum). Editable.",
    TH: "ดึงข้อมูลอัตโนมัติจากไฟล์ที่อัปโหลด (Order Minimum) สามารถแก้ไขได้"
  },
  "Auto-extracted from the uploaded manifest (Order MCQ). Editable.": {
    EN: "Auto-extracted from the uploaded manifest (Order MCQ). Editable.",
    TH: "ดึงข้อมูลอัตโนมัติจากไฟล์ที่อัปโหลด (Order MCQ) สามารถแก้ไขได้"
  },
  "Manual Shipment Date Overrides:": {
    EN: "Manual Shipment Date Overrides:",
    TH: "การกำหนดวันเดินเรือด้วยตนเอง:"
  },
  "By default, shipment dates are dynamically calculated starting from the earliest PR Due Date (D0) minus transit time. If you need to avoid weekends, handle MCQ/MOQ issues, or adjust a specific vessel departure, manually override any date below.": {
    EN: "By default, shipment dates are dynamically calculated starting from the earliest PR Due Date (D0) minus transit time. If you need to avoid weekends, handle MCQ/MOQ issues, or adjust a specific vessel departure, manually override any date below.",
    TH: "โดยปกติ วันเดินเรือจะคำนวณแบบพลวัตจากวันกำหนดส่ง PR ที่เร็วที่สุด (D0) หักระยะเวลาขนส่ง หากต้องการเลี่ยงวันหยุดสุดสัปดาห์, จัดการยอดสั่งผลิตต่ำกว่าเกณฑ์ หรือปรับตามตารางเดินเรือจริง สามารถกำหนดวันที่ด้วยตนเองได้ด้านล่าง"
  },
  "Custom Shipping Quotes:": {
    EN: "Custom Shipping Quotes:",
    TH: "ใบเสนอราคาค่าขนส่งตามจริง:"
  },
  "Define active ocean tariffs by origin. Quotes override default pricing for any shipments planned on or after the Effective Date.": {
    EN: "Define active ocean tariffs by origin. Quotes override default pricing for any shipments planned on or after the Effective Date.",
    TH: "ระบุอัตราค่าระวางตู้คอนเทนเนอร์ตามท่าเรือต้นทาง ใบเสนอราคานี้จะแทนที่ราคาตั้งต้นสำหรับการขนส่งที่มีผลตั้งแต่วันที่มีผลบังคับใช้เป็นต้นไป"
  },
  "Warehouse Delay (Port Rent):": {
    EN: "Warehouse Delay (Port Rent):",
    TH: "คลังสินค้าล่าช้า (ค่าเช่าคลังท่าเรือ):"
  },
  "Simulate unexpected congestion. Delayed containers accrue rent at the Port Warehouse daily, which is added directly to local landed costs.": {
    EN: "Simulate unexpected congestion. Delayed containers accrue rent at the Port Warehouse daily, which is added directly to local landed costs.",
    TH: "จำลองสถานการณ์ความล่าช้าสะสม ตู้สินค้าที่ตกค้างจะถูกคิดค่าเช่าโกดังท่าเรือรายวัน ซึ่งจะถูกนำไปบวกรวมกับค่าใช้จ่ายแลนเดดโดยตรง"
  },
  "Excess MCQ Overrides:": {
    EN: "Excess MCQ Overrides:",
    TH: "การปัดเศษเพิ่มส่วนเกิน MCQ ด้วยตนเอง:"
  },
  "Select a color and optionally a specific item, then specify the additional quantity to add. Price and CBM per unit are automatically retrieved from the dataset to ensure total landed cost and volume update correctly.": {
    EN: "Select a color and optionally a specific item, then specify the additional quantity to add. Price and CBM per unit are automatically retrieved from the dataset to ensure total landed cost and volume update correctly.",
    TH: "เลือกสีและเลือก (รหัสสินค้า) จากนั้นกำหนดปริมาณที่ต้องการเพิ่ม ระบบจะดึงราคาและปริมาตร CBM ต่อหลาจากฐานข้อมูลเพื่อคำนวณต้นทุนรวมแลนเดดและสเปซตู้สินค้าใหม่อย่างแม่นยำ"
  },
  "Last Loading Dates for Vendors:": {
    EN: "Last Loading Dates for Vendors:",
    TH: "กำหนดวันโหลดตู้รอบสุดท้ายของผู้ผลิต (Vendor Loading Date):"
  },
  "These dates represent the target vendor departure dates mapped from country rules.": {
    EN: "These dates represent the target vendor departure dates mapped from country rules.",
    TH: "วันเหล่านี้ระบุวันเดดไลน์กำหนดเรือออกจากท่าเรือของซัพพลายเออร์ที่สอดคล้องกับระเบียบประเทศต้นทาง"
  },
  "Final Mapped Syteline Planning Sheet (Duplicated & Balanced):": {
    EN: "Final Mapped Syteline Planning Sheet (Duplicated & Balanced):",
    TH: "ตารางวางแผนระบบ Syteline ฉบับสมบูรณ์ (คัดลอกและสมดุลแล้ว):"
  },
  "This duplicate PR ledger reflects the exact rounded integer purchase quantities, adjusted proportionate CBM volumes, and actual financial Carrying & Capital opportunity penalty costs for each entry. Rounding or MCQ/MOQ excess is automatically compiled and added directly to the latest entry on that shipment date as required.": {
    EN: "This duplicate PR ledger reflects the exact rounded integer purchase quantities, adjusted proportionate CBM volumes, and actual financial Carrying & Capital opportunity penalty costs for each entry. Rounding or MCQ/MOQ excess is automatically compiled and added directly to the latest entry on that shipment date as required.",
    TH: "บัญชีแยกประเภท PR ที่คัดลอกและปัดเศษสมดุลนี้จะสะท้อนถึงจำนวนสั่งซื้อปัดเศษจริง, อัปเดตปริมาตรตู้ (CBM) ตามสัดส่วน และคิดคำนวณต้นทุนค่าจัดเก็บและเสียโอกาสทางการเงินตามจริงของแต่ละรายการ การปัดเศษหรือยอดสั่งซื้อส่วนเกิน MCQ/MOQ จะถูกคำนวณสะสมและบวกเข้ากับรายการล่าสุดในสัปดาห์จัดส่งนั้นโดยอัตโนมัติ"
  },
  "Syteline / ERP Planning Sheet Upload": {
    EN: "Syteline / ERP Planning Sheet Upload",
    TH: "อัปโหลดตารางแผนงานสั่งจัดซื้อจาก Syteline / ERP"
  },
  "Import Purchase Requisitions (PR) to run the Weeks Scenario scheduling, MCQ consolidated check, and rounding engine.": {
    EN: "Import Purchase Requisitions (PR) to run the Weeks Scenario scheduling, MCQ consolidated check, and rounding engine.",
    TH: "นำเข้าข้อมูลใบขอซื้อจัดจ้าง (PR) เพื่อคำนวณแผนการจัดส่งรายสัปดาห์ ตรวจสอบและดึงยอดผ่าน MCQ และประมวลผลการปัดเศษสินค้าสะสม"
  },
  "Load VT Garment Sample Data": {
    EN: "Load VT Garment Sample Data",
    TH: "โหลดชุดข้อมูลตัวอย่างจัดซื้อของ VT Garment"
  },
  "Drag & Drop Syteline sheet (.xlsx, .xls, .csv)": {
    EN: "Drag & Drop Syteline sheet (.xlsx, .xls, .csv)",
    TH: "ลากและวางไฟล์ตารางแผนงาน Syteline (.xlsx, .xls, .csv)"
  },
  "or click to browse your computer's files": {
    EN: "or click to browse your computer's files",
    TH: "หรือคลิกเพื่อค้นหาและเลือกไฟล์จากคอมพิวเตอร์ของคุณ"
  },
  "Active Ledger: ": {
    EN: "Active Ledger: ",
    TH: "บัญชีจัดซื้อปัจจุบัน: "
  },
  " PR entries loaded": {
    EN: " PR entries loaded",
    TH: " รายการ PR ถูกโหลดเข้าสู่ระบบแล้ว"
  },
  "Scenario Slicer": {
    EN: "Scenario Slicer",
    TH: "แบบจำลองรอบจัดส่ง"
  },
  "Schedules shipment schedules dynamically, setting Shipment 1 on the earliest due date, spaced at least a week apart.": {
    EN: "Schedules shipment schedules dynamically, setting Shipment 1 on the earliest due date, spaced at least a week apart.",
    TH: "กำหนดรอบเดินเรือแบบพลวัต โดยเริ่มการจัดส่งครั้งที่ 1 ตามวันส่งมอบ PR ที่เร็วที่สุด และเว้นระยะห่างในแต่ละรอบไม่ต่ำกว่า 1 สัปดาห์"
  },
  "MOQ Consolidation": {
    EN: "MOQ Consolidation",
    TH: "การจัดการยอดผ่าน MCQ"
  },
  "Automatically highlights sub-threshold color shipments and pulls them earlier to meet suppliers' MOQ/MCQ targets.": {
    EN: "Automatically highlights sub-threshold color shipments and pulls them earlier to meet suppliers' MOQ/MCQ targets.",
    TH: "ตรวจจับและไฮไลต์สีที่มีปริมาณต่ำกว่าเกณฑ์ขั้นต่ำโดยอัตโนมัติ และระบบจะดึงรายการขึ้นมาจัดส่งเร็วขึ้นเพื่อให้ตรงตามเป้าหมายของซัพพลายเออร์"
  },
  "Container Lock": {
    EN: "Container Lock",
    TH: "ระบบตรวจสอบตู้สินค้า"
  },
  "Verifies container requirements against the consolidated Baseline (Scenario 1), flagging container mismatches for review.": {
    EN: "Verifies container requirements against the consolidated Baseline (Scenario 1), flagging container mismatches for review.",
    TH: "ตรวจสอบสเปคตู้สินค้าเปรียบเทียบกับแบบจำลองตั้งต้น (สถานการณ์ที่ 1) และทำการแสดงข้อความเตือนเมื่อขนาดตู้ไม่ตรงกันเพื่อการสุ่มตรวจซ้ำอย่างแม่นยำ"
  },
  "Select Standard": {
    EN: "Select Standard",
    TH: "เลือกเกณฑ์การใช้งาน"
  },
  "Use Surcharge Rule": {
    EN: "Use Surcharge Rule",
    TH: "ยึดตาม Surcharge Rule"
  },
  "Use PR File": {
    EN: "Use PR File",
    TH: "ยึดตามไฟล์ PR"
  },
  "MCQ Pull-Forward": {
    EN: "MCQ Pull-Forward",
    TH: "MCQ Pull-Forward"
  },
  "Enable MCQ pull forward": {
    EN: "MCQ Pull-Forward",
    TH: "MCQ Pull-Forward"
  },
  "keep as 0": {
    EN: "Keep As 0",
    TH: "คงไว้เป็น 0"
  },
  "accept": {
    EN: "Accept",
    TH: "ยอมรับ"
  },
  "pay for surcharge": {
    EN: "Pay For Surcharge",
    TH: "ชำระค่าธรรมเนียม surcharge"
  },
  "20ft Rent": {
    EN: "20ft Rent",
    TH: "ค่าเช่าตู้ 20 ฟุต"
  },
  "40HQ Rent": {
    EN: "40HQ Rent",
    TH: "ค่าเช่าตู้ 40HQ"
  },
  "40ft Rent": {
    EN: "40ft Rent",
    TH: "ค่าเช่าตู้ 40 ฟุต"
  },
  "ACTIVE": {
    EN: "ACTIVE",
    TH: "ใช้งานอยู่"
  },
  "Absolute Optimal Fleet Recommendation": {
    EN: "Absolute Optimal Fleet Recommendation",
    TH: "คำแนะนำฟลีทที่เหมาะสมที่สุด"
  },
  "Act as wildcards and apply to all items/colors/sizes under that customer/vendor.": {
    EN: "Act as wildcards and apply to all items/colors/sizes under that customer/vendor.",
    TH: "ทำหน้าที่เป็นไวลด์การ์ดและใช้กับสินค้า/สี/ไซส์ทั้งหมดภายใต้ลูกค้า/ผู้ขายรายนั้น"
  },
  "Action": {
    EN: "Action",
    TH: "การดำเนินการ"
  },
  "Active": {
    EN: "Active",
    TH: "ใช้งาน"
  },
  "Active Imported Quotes": {
    EN: "Active Imported Quotes",
    TH: "ใบเสนอราคาที่นำเข้าและใช้งานอยู่"
  },
  "Active Incoterm Rules": {
    EN: "Active Incoterm Rules",
    TH: "กฎ Incoterm ที่ใช้งานอยู่"
  },
  "Active Shipments": {
    EN: "Active Shipments",
    TH: "ชิปเมนต์ที่ใช้งานอยู่"
  },
  "Active Surcharge Rules": {
    EN: "Active Surcharge Rules",
    TH: "กฎค่าธรรมเนียมที่ใช้งานอยู่"
  },
  "Add Padding Override": {
    EN: "Add Padding Override",
    TH: "เพิ่มการปรับจำนวนพิเศษ (Padding)"
  },
  "Add Rule": {
    EN: "Add Rule",
    TH: "เพิ่มกฎ"
  },
  "Additional Qty (YD)": {
    EN: "Additional Qty (YD)",
    TH: "จำนวนเพิ่มเติม (หลา)"
  },
  "All Items under Color": {
    EN: "All Items under Color",
    TH: "สินค้าทั้งหมดในสีนี้"
  },
  "All Legs Total": {
    EN: "All Legs Total",
    TH: "รวมทุกเลกทั้งหมด"
  },
  "Amount": {
    EN: "Amount",
    TH: "จำนวนเงิน"
  },
  "Amount in THB": {
    EN: "Amount in THB",
    TH: "จำนวนเงิน (บาท)"
  },
  "Approved Container Match": {
    EN: "Approved Container Match",
    TH: "การจับคู่ตู้คอนเทนเนอร์ที่อนุมัติ"
  },
  "Auto / Under MCQ": {
    EN: "Auto / Under MCQ",
    TH: "อัตโนมัติ / ต่ำกว่า MCQ"
  },
  "Automatically pulls later PR entries forward into earlier shipments when a color is below MOQ/MCQ threshold, consolidating shipment lots and avoiding small-lot surcharges.": {
    EN: "Automatically pulls later PR entries forward into earlier shipments when a color is below MOQ/MCQ threshold, consolidating shipment lots and avoiding small-lot surcharges.",
    TH: "ดึงรายการ PR ในรอบถัดไปมาไว้ในชิปเมนต์ก่อนหน้าโดยอัตโนมัติ เมื่อสีนั้นมีจำนวนต่ำกว่าเกณฑ์ MOQ/MCQ เพื่อรวมล็อตการจัดส่งและหลีกเลี่ยงค่าธรรมเนียมล็อตเล็ก"
  },
  "Best Config": {
    EN: "Best Config",
    TH: "การตั้งค่าที่ดีที่สุด"
  },
  "Best Landed Cost": {
    EN: "Best Landed Cost",
    TH: "ต้นทุนนำเข้ารวมที่ดีที่สุด"
  },
  "Best Overall Price": {
    EN: "Best Overall Price",
    TH: "ราคารวมที่ดีที่สุด"
  },
  "Blank Fields": {
    EN: "Blank Fields",
    TH: "ช่องว่างเปล่า"
  },
  "Buy Rate On PR Date": {
    EN: "Buy Rate On PR Date",
    TH: "อัตราแลกเปลี่ยน ณ วันที่ PR"
  },
  "By Container": {
    EN: "By Container",
    TH: "ตามตู้คอนเทนเนอร์"
  },
  "By Shipment": {
    EN: "By Shipment",
    TH: "ตามชิปเมนต์"
  },
  "By default, shipment dates are dynamically calculated by grouping PRs into natural gaps, finding the earliest PR Due Date per group, subtracting transit time, and snapping backwards to the allowed Loading Departure Days. You can manually override the computed departure date for any specific shipment group below.": {
    EN: "By default, shipment dates are dynamically calculated by grouping PRs into natural gaps, finding the earliest PR Due Date per group, subtracting transit time, and snapping backwards to the allowed Loading Departure Days. You can manually override the computed departure date for any specific shipment group below.",
    TH: "โดยค่าเริ่มต้น วันที่จัดส่งจะถูกคำนวณแบบไดนามิกโดยการจัดกลุ่ม PR ตามช่องว่างตามธรรมชาติ หาวันครบกำหนด PR ที่เร็วที่สุดในแต่ละกลุ่ม หักลบเวลาขนส่ง แล้วปรับย้อนกลับไปยังวันออกเรือที่อนุญาต คุณสามารถแก้ไขวันออกเรือที่คำนวณได้ด้วยตนเองสำหรับกลุ่มชิปเมนต์ใดๆ ด้านล่าง"
  },
  "Capital Opportunity Cost": {
    EN: "Capital Opportunity Cost",
    TH: "ต้นทุนค่าเสียโอกาสของเงินทุน"
  },
  "Carrying & Capital": {
    EN: "Carrying & Capital",
    TH: "ต้นทุนถือครองและเงินทุน"
  },
  "Carrying & Opportunity": {
    EN: "Carrying & Opportunity",
    TH: "ต้นทุนถือครองและค่าเสียโอกาส"
  },
  "Cheapest": {
    EN: "Cheapest",
    TH: "ถูกที่สุด"
  },
  "Cheapest True Landed Cost": {
    EN: "Cheapest True Landed Cost",
    TH: "ต้นทุนนำเข้ารวมที่แท้จริงถูกที่สุด"
  },
  "Clarification:": {
    EN: "Clarification:",
    TH: "คำชี้แจง:"
  },
  "Clear All": {
    EN: "Clear All",
    TH: "ล้างทั้งหมด"
  },
  "Click any card for full details and surcharge breakdowns.": {
    EN: "Click any card for full details and surcharge breakdowns.",
    TH: "คลิกที่การ์ดใดก็ได้เพื่อดูรายละเอียดและรายการค่าธรรมเนียมทั้งหมด"
  },
  "Color / Item": {
    EN: "Color / Item",
    TH: "สี / สินค้า"
  },
  "Color Code": {
    EN: "Color Code",
    TH: "รหัสสี"
  },
  "Colour": {
    EN: "Colour",
    TH: "สี"
  },
  "Compare real-world shipping dates, container allocations, and volume profiles across all 2.1, 2.2, and 3.0 subscenarios.": {
    EN: "Compare real-world shipping dates, container allocations, and volume profiles across all 2.1, 2.2, and 3.0 subscenarios.",
    TH: "เปรียบเทียบวันจัดส่งจริง การจัดสรรตู้คอนเทนเนอร์ และปริมาณสินค้าในทุกสถานการณ์ย่อย 2.1, 2.2 และ 3.0"
  },
  "Configure dynamic surcharges for shipments based on your specific vendor agreements. Upload an Excel or CSV spreadsheet containing your surcharge structure, or configure individual rules manually. Rules are matched dynamically against items in each shipment based on the highest specificity score.": {
    EN: "Configure dynamic surcharges for shipments based on your specific vendor agreements. Upload an Excel or CSV spreadsheet containing your surcharge structure, or configure individual rules manually. Rules are matched dynamically against items in each shipment based on the highest specificity score.",
    TH: "ตั้งค่าค่าธรรมเนียมแบบไดนามิกสำหรับชิปเมนต์ตามข้อตกลงกับผู้ขายของคุณ อัปโหลดไฟล์ Excel หรือ CSV ที่มีโครงสร้างค่าธรรมเนียม หรือตั้งค่ากฎแต่ละรายการด้วยตนเอง ระบบจะจับคู่กฎกับสินค้าในแต่ละชิปเมนต์แบบไดนามิกตามคะแนนความเจาะจงสูงสุด"
  },
  "Configure holding costs and capital opportunity rates used to calculate true landed costs for early shipments.": {
    EN: "Configure holding costs and capital opportunity rates used to calculate true landed costs for early shipments.",
    TH: "ตั้งค่าต้นทุนการถือครองสินค้าและอัตราค่าเสียโอกาสของเงินทุน เพื่อใช้คำนวณต้นทุนนำเข้ารวมที่แท้จริงสำหรับชิปเมนต์ที่มาถึงก่อนกำหนด"
  },
  "Consolidated Material Value": {
    EN: "Consolidated Material Value",
    TH: "มูลค่าวัตถุดิบรวม"
  },
  "Container Bookings": {
    EN: "Container Bookings",
    TH: "การจองตู้คอนเทนเนอร์"
  },
  "Container Fleet Matrix & Optimization Engine": {
    EN: "Container Fleet Matrix & Optimization Engine",
    TH: "เครื่องมือคำนวณและเมทริกซ์ฟลีทตู้คอนเทนเนอร์"
  },
  "Container Mismatch": {
    EN: "Container Mismatch",
    TH: "ตู้คอนเทนเนอร์ไม่ตรงกัน"
  },
  "Container Size": {
    EN: "Container Size",
    TH: "ขนาดตู้คอนเทนเนอร์"
  },
  "Curr": {
    EN: "Curr",
    TH: "สกุลเงิน"
  },
  "Cust. Code": {
    EN: "Cust. Code",
    TH: "รหัสลูกค้า"
  },
  "Customs Brokerage (per leg)": {
    EN: "Customs Brokerage (per leg)",
    TH: "ค่าดำเนินพิธีการศุลกากร (ต่อเลก)"
  },
  "Daily Warehouse Rent Rates (THB / Day)": {
    EN: "Daily Warehouse Rent Rates (THB / Day)",
    TH: "อัตราค่าเช่าคลังสินค้ารายวัน (บาท/วัน)"
  },
  "Days Early (Shipment classification):": {
    EN: "Days Early (Shipment classification):",
    TH: "จำนวนวันล่วงหน้า (การจัดประเภทชิปเมนต์):"
  },
  "Default Color Minimum Color Quantity (MCQ)": {
    EN: "Default Color Minimum Color Quantity (MCQ)",
    TH: "จำนวนขั้นต่ำต่อสีเริ่มต้น (MCQ)"
  },
  "Default Minimum Order Quantity (MOQ)": {
    EN: "Default Minimum Order Quantity (MOQ)",
    TH: "จำนวนสั่งซื้อขั้นต่ำเริ่มต้น (MOQ)"
  },
  "Delayed containers accrue size-specific rent below daily.": {
    EN: "Delayed containers accrue size-specific rent below daily.",
    TH: "ตู้คอนเทนเนอร์ที่ล่าช้าจะมีค่าเช่าตามขนาดสะสมตามรายวันด้านล่าง"
  },
  "Detailed Breakdown": {
    EN: "Detailed Breakdown",
    TH: "รายละเอียดแบบละเอียด"
  },
  "Download Template": {
    EN: "Download Template",
    TH: "ดาวน์โหลดเทมเพลต"
  },
  "Download our official CSV spreadsheet template to structure your customer, vendor, and color surcharge rules perfectly before importing.": {
    EN: "Download our official CSV spreadsheet template to structure your customer, vendor, and color surcharge rules perfectly before importing.",
    TH: "ดาวน์โหลดเทมเพลตไฟล์ CSV อย่างเป็นทางการของเราเพื่อจัดโครงสร้างกฎค่าธรรมเนียมตามลูกค้า ผู้ขาย และสีให้ถูกต้องก่อนนำเข้า"
  },
  "Dynamic Surcharge Rules Engine": {
    EN: "Dynamic Surcharge Rules Engine",
    TH: "เครื่องมือกฎค่าธรรมเนียมแบบไดนามิก"
  },
  "Dynamically evaluate combinations of [40HQ, 40ft, 20ft, LCL] across multiple timing splits to find the absolute lowest cost.": {
    EN: "Dynamically evaluate combinations of [40HQ, 40ft, 20ft, LCL] across multiple timing splits to find the absolute lowest cost.",
    TH: "ประเมินการรวมกันของ [40HQ, 40ft, 20ft, LCL] แบบไดนามิกในหลายรูปแบบการแบ่งช่วงเวลา เพื่อหาต้นทุนที่ต่ำที่สุด"
  },
  "Enable MCQ Pull-Forward Optimization": {
    EN: "Enable MCQ Pull-Forward Optimization",
    TH: "เปิดใช้งานการเพิ่มประสิทธิภาพ MCQ Pull-Forward"
  },
  "Excel Format Requirements": {
    EN: "Excel Format Requirements",
    TH: "ข้อกำหนดรูปแบบไฟล์ Excel"
  },
  "Excess Propagation:": {
    EN: "Excess Propagation:",
    TH: "การกระจายส่วนเกิน:"
  },
  "Expense Type": {
    EN: "Expense Type",
    TH: "ประเภทค่าใช้จ่าย"
  },
  "Extracted from uploaded PR data (Buy Rate On PR Date)": {
    EN: "Extracted from uploaded PR data (Buy Rate On PR Date)",
    TH: "ดึงข้อมูลจากไฟล์ PR ที่อัปโหลด (อัตราแลกเปลี่ยน ณ วันที่ PR)"
  },
  "FCL & LCL Quotes Import & Tariffs:": {
    EN: "FCL & LCL Quotes Import & Tariffs:",
    TH: "การนำเข้าใบเสนอราคา FCL และ LCL และอัตราภาษี:"
  },
  "Financial & Inventory Holding Rates": {
    EN: "Financial & Inventory Holding Rates",
    TH: "อัตราต้นทุนทางการเงินและการถือครองสินค้าคงคลัง"
  },
  "Fleet Matrix Rules": {
    EN: "Fleet Matrix Rules",
    TH: "กฎเมทริกซ์ฟลีท"
  },
  "Freight Ocean Fee (per leg)": {
    EN: "Freight Ocean Fee (per leg)",
    TH: "ค่าระวางเรือ (ต่อเลก)"
  },
  "Global Exchange Rates (THB per Currency)": {
    EN: "Global Exchange Rates (THB per Currency)",
    TH: "อัตราแลกเปลี่ยนทั่วโลก (บาทต่อสกุลเงิน)"
  },
  "Import shipping quotes for all countries directly from an Excel sheet. The engine will automatically parse columns, convert foreign currencies to THB, and calculate precise landed costs.": {
    EN: "Import shipping quotes for all countries directly from an Excel sheet. The engine will automatically parse columns, convert foreign currencies to THB, and calculate precise landed costs.",
    TH: "นำเข้าใบเสนอราคาการขนส่งจากทุกประเทศโดยตรงจากไฟล์ Excel ระบบจะแยกวิเคราะห์คอลัมน์ แปลงสกุลเงินต่างประเทศเป็นบาท และคำนวณต้นทุนนำเข้ารวมอย่างแม่นยำโดยอัตโนมัติ"
  },
  "Incoterm": {
    EN: "Incoterm",
    TH: "Incoterm"
  },
  "Incoterm Mapping": {
    EN: "Incoterm Mapping",
    TH: "การแมป Incoterm"
  },
  "Incoterms": {
    EN: "Incoterms",
    TH: "Incoterms"
  },
  "Inject Order Padding Override": {
    EN: "Inject Order Padding Override",
    TH: "เพิ่มการปรับจำนวนคำสั่งซื้อพิเศษ"
  },
  "Inventory Carrying Penalty": {
    EN: "Inventory Carrying Penalty",
    TH: "ค่าปรับจากการถือครองสินค้าคงคลัง"
  },
  "LCL (< 19 CBM) Rent per CBM": {
    EN: "LCL (< 19 CBM) Rent per CBM",
    TH: "ค่าเช่า LCL (< 19 CBM) ต่อ CBM"
  },
  "Leg": {
    EN: "Leg",
    TH: "เลก"
  },
  "Leg Logistics Total": {
    EN: "Leg Logistics Total",
    TH: "รวมค่าโลจิสติกส์ต่อเลก"
  },
  "Legs": {
    EN: "Legs",
    TH: "เลก"
  },
  "Local Port Dues / THC (per leg)": {
    EN: "Local Port Dues / THC (per leg)",
    TH: "ค่าธรรมเนียมท่าเรือ / THC (ต่อเลก)"
  },
  "Logistics & Shipping Cost": {
    EN: "Logistics & Shipping Cost",
    TH: "ต้นทุนโลจิสติกส์และการขนส่ง"
  },
  "Logistics Fees": {
    EN: "Logistics Fees",
    TH: "ค่าธรรมเนียมโลจิสติกส์"
  },
  "Logistics Total:": {
    EN: "Logistics Total:",
    TH: "รวมโลจิสติกส์:"
  },
  "MCQ MCQ Surcharge": {
    EN: "MCQ MCQ Surcharge",
    TH: "ค่าธรรมเนียม MCQ"
  },
  "MCQ Pull-Forward Optimization": {
    EN: "MCQ Pull-Forward Optimization",
    TH: "การเพิ่มประสิทธิภาพ MCQ Pull-Forward"
  },
  "MOQ / MCQ Surcharge Sinks": {
    EN: "MOQ / MCQ Surcharge Sinks",
    TH: "จุดรวมค่าธรรมเนียม MOQ / MCQ"
  },
  "MOQ Penalty (MCQ Surcharge)": {
    EN: "MOQ Penalty (MCQ Surcharge)",
    TH: "ค่าปรับ MOQ (ค่าธรรมเนียม MCQ)"
  },
  "Map Vendor Codes and Origins to specific Incoterms (FOB, EXW, CIF, DDP, CFR, FCA). This mapping determines which parts of the shipping cost are paid by us versus the vendor, as explained in the reference table below:": {
    EN: "Map Vendor Codes and Origins to specific Incoterms (FOB, EXW, CIF, DDP, CFR, FCA). This mapping determines which parts of the shipping cost are paid by us versus the vendor, as explained in the reference table below:",
    TH: "แมปรหัสผู้ขายและแหล่งกำเนิดสินค้ากับ Incoterms ที่กำหนด (FOB, EXW, CIF, DDP, CFR, FCA) การแมปนี้จะกำหนดว่าต้นทุนการขนส่งส่วนใดที่เราเป็นผู้จ่ายเทียบกับผู้ขาย ตามที่อธิบายในตารางอ้างอิงด้านล่าง:"
  },
  "Matches all colors except BLACK.": {
    EN: "Matches all colors except BLACK.",
    TH: "จับคู่ทุกสียกเว้นสีดำ"
  },
  "Material Value": {
    EN: "Material Value",
    TH: "มูลค่าวัตถุดิบ"
  },
  "Max": {
    EN: "Max",
    TH: "สูงสุด"
  },
  "Min": {
    EN: "Min",
    TH: "ต่ำสุด"
  },
  "New": {
    EN: "New",
    TH: "ใหม่"
  },
  "New container rent exposure": {
    EN: "New container rent exposure",
    TH: "ค่าเช่าตู้คอนเทนเนอร์ใหม่ที่ต้องรับผิดชอบ"
  },
  "Newly subject to rent": {
    EN: "Newly subject to rent",
    TH: "เริ่มมีภาระค่าเช่าใหม่"
  },
  "No Items Scheduled": {
    EN: "No Items Scheduled",
    TH: "ไม่มีรายการที่กำหนดตาราง"
  },
  "No incoterm rules defined.": {
    EN: "No incoterm rules defined.",
    TH: "ยังไม่ได้กำหนดกฎ Incoterm"
  },
  "Option 1: Send all items in 1 shipment": {
    EN: "Option 1: Send all items in 1 shipment",
    TH: "ตัวเลือกที่ 1: ส่งสินค้าทั้งหมดในชิปเมนต์เดียว"
  },
  "Option 2: Divide into 2 shipments": {
    EN: "Option 2: Divide into 2 shipments",
    TH: "ตัวเลือกที่ 2: แบ่งเป็น 2 ชิปเมนต์"
  },
  "Option 3: Divide into 3 separate shipments": {
    EN: "Option 3: Divide into 3 separate shipments",
    TH: "ตัวเลือกที่ 3: แบ่งเป็น 3 ชิปเมนต์แยกกัน"
  },
  "Origin (Ship From)": {
    EN: "Origin (Ship From)",
    TH: "แหล่งกำเนิด (จัดส่งจาก)"
  },
  "Original Amount": {
    EN: "Original Amount",
    TH: "จำนวนเงินเดิม"
  },
  "Other colour": {
    EN: "Other colour",
    TH: "สีอื่น"
  },
  "Padded Qty": {
    EN: "Padded Qty",
    TH: "จำนวนที่เพิ่ม"
  },
  "Payment Type": {
    EN: "Payment Type",
    TH: "ประเภทการชำระเงิน"
  },
  "Port Delay (Days)": {
    EN: "Port Delay (Days)",
    TH: "ความล่าช้าที่ท่าเรือ (วัน)"
  },
  "Port Departure (ETD):": {
    EN: "Port Departure (ETD):",
    TH: "วันออกจากท่าเรือ (ETD):"
  },
  "Port Warehouse Storage Rent (per leg)": {
    EN: "Port Warehouse Storage Rent (per leg)",
    TH: "ค่าเช่าคลังสินค้าที่ท่าเรือ (ต่อเลก)"
  },
  "Price": {
    EN: "Price",
    TH: "ราคา"
  },
  "Qty/Amt": {
    EN: "Qty/Amt",
    TH: "จำนวน/มูลค่า"
  },
  "Range check (Min, Max)": {
    EN: "Range check (Min, Max)",
    TH: "ตรวจสอบช่วง (ต่ำสุด, สูงสุด)"
  },
  "Rates": {
    EN: "Rates",
    TH: "อัตรา"
  },
  "Rates automatically applied to foreign currency items & quotes": {
    EN: "Rates automatically applied to foreign currency items & quotes",
    TH: "อัตราที่ใช้กับรายการและใบเสนอราคาสกุลเงินต่างประเทศโดยอัตโนมัติ"
  },
  "Recommended Fleet Suggestion": {
    EN: "Recommended Fleet Suggestion",
    TH: "ข้อเสนอแนะฟลีทที่แนะนำ"
  },
  "Retrieved CBM per YD": {
    EN: "Retrieved CBM per YD",
    TH: "CBM ต่อหลาที่ดึงมา"
  },
  "Retrieved Unit Price": {
    EN: "Retrieved Unit Price",
    TH: "ราคาต่อหน่วยที่ดึงมา"
  },
  "SL Description": {
    EN: "SL Description",
    TH: "รายละเอียด SL"
  },
  "Sample": {
    EN: "Sample",
    TH: "ตัวอย่าง"
  },
  "Scenario Best": {
    EN: "Scenario Best",
    TH: "สถานการณ์ที่ดีที่สุด"
  },
  "Selected Schedule": {
    EN: "Selected Schedule",
    TH: "ตารางที่เลือก"
  },
  "Ship From": {
    EN: "Ship From",
    TH: "จัดส่งจาก"
  },
  "Shipment Departure Calendar & Container Booking Plan": {
    EN: "Shipment Departure Calendar & Container Booking Plan",
    TH: "ปฏิทินการออกเรือและแผนการจองตู้คอนเทนเนอร์"
  },
  "Size": {
    EN: "Size",
    TH: "ขนาด"
  },
  "Source": {
    EN: "Source",
    TH: "แหล่งที่มา"
  },
  "Sourced Qty:": {
    EN: "Sourced Qty:",
    TH: "จำนวนที่จัดหา:"
  },
  "Sourcing & Financial Costs": {
    EN: "Sourcing & Financial Costs",
    TH: "ต้นทุนการจัดซื้อและการเงิน"
  },
  "Surcharge Template": {
    EN: "Surcharge Template",
    TH: "เทมเพลตค่าธรรมเนียม"
  },
  "Surcharge Type": {
    EN: "Surcharge Type",
    TH: "ประเภทค่าธรรมเนียม"
  },
  "Surcharges": {
    EN: "Surcharges",
    TH: "ค่าธรรมเนียม"
  },
  "Surcharges are evaluated per shipment. Surcharges apply if the shipment volume/value falls within the [Min, Max] range.": {
    EN: "Surcharges are evaluated per shipment. Surcharges apply if the shipment volume/value falls within the [Min, Max] range.",
    TH: "ค่าธรรมเนียมจะถูกประเมินต่อชิปเมนต์ โดยจะมีผลหากปริมาณ/มูลค่าชิปเมนต์อยู่ในช่วง [ต่ำสุด, สูงสุด]"
  },
  "Syteline Arrival (ETA):": {
    EN: "Syteline Arrival (ETA):",
    TH: "วันถึง Syteline (ETA):"
  },
  "Syteline Subscenarios & Live Shipping Calendar": {
    EN: "Syteline Subscenarios & Live Shipping Calendar",
    TH: "สถานการณ์ย่อย Syteline และปฏิทินการขนส่งแบบสด"
  },
  "Target": {
    EN: "Target",
    TH: "เป้าหมาย"
  },
  "Target Shipment": {
    EN: "Target Shipment",
    TH: "ชิปเมนต์เป้าหมาย"
  },
  "Template": {
    EN: "Template",
    TH: "เทมเพลต"
  },
  "The Fleet Solver above explores hypothetical symmetrical splits. This calendar below displays the actual tactical schedules compiled from item-level production due dates, MOQ bounds, and pull-forwards.": {
    EN: "The Fleet Solver above explores hypothetical symmetrical splits. This calendar below displays the actual tactical schedules compiled from item-level production due dates, MOQ bounds, and pull-forwards.",
    TH: "เครื่องมือคำนวณฟลีทด้านบนจะสำรวจการแบ่งสมมาตรสมมติ ส่วนปฏิทินด้านล่างนี้แสดงตารางเชิงกลยุทธ์จริงที่รวบรวมจากวันครบกำหนดการผลิตระดับรายการสินค้า ขอบเขต MOQ และการเลื่อนล่วงหน้า"
  },
  "Three-Way Shipment Cost Comparison & Contrasting Overview": {
    EN: "Three-Way Shipment Cost Comparison & Contrasting Overview",
    TH: "ภาพรวมเปรียบเทียบต้นทุนการจัดส่งสามแนวทาง"
  },
  "Total Capacity": {
    EN: "Total Capacity",
    TH: "ความจุรวม"
  },
  "Total Landed Cost": {
    EN: "Total Landed Cost",
    TH: "ต้นทุนนำเข้ารวมทั้งหมด"
  },
  "Total Shipment Volume": {
    EN: "Total Shipment Volume",
    TH: "ปริมาณชิปเมนต์รวม"
  },
  "Total Sourcing Surcharges": {
    EN: "Total Sourcing Surcharges",
    TH: "ค่าธรรมเนียมการจัดซื้อรวม"
  },
  "Total Volume": {
    EN: "Total Volume",
    TH: "ปริมาณรวม"
  },
  "Total suggested containers": {
    EN: "Total suggested containers",
    TH: "จำนวนตู้คอนเทนเนอร์ที่แนะนำรวม"
  },
  "True Landed Cost Formula": {
    EN: "True Landed Cost Formula",
    TH: "สูตรต้นทุนนำเข้ารวมที่แท้จริง"
  },
  "VT Garment Logistics Optimization Workspace": {
    EN: "VT Garment Logistics Optimization Workspace",
    TH: "พื้นที่ทำงานเพิ่มประสิทธิภาพโลจิสติกส์ VT Garment"
  },
  "VT Planning Rules Summary": {
    EN: "VT Planning Rules Summary",
    TH: "สรุปกฎการวางแผน VT"
  },
  "Valid Fleet Permutations (Sorted by Landed Cost)": {
    EN: "Valid Fleet Permutations (Sorted by Landed Cost)",
    TH: "ชุดฟลีทที่เป็นไปได้ (เรียงตามต้นทุนนำเข้ารวม)"
  },
  "Validation Rules Mode: Standard": {
    EN: "Validation Rules Mode: Standard",
    TH: "โหมดกฎการตรวจสอบ: มาตรฐาน"
  },
  "Vendor Code": {
    EN: "Vendor Code",
    TH: "รหัสผู้ขาย"
  },
  "Volume Per Leg": {
    EN: "Volume Per Leg",
    TH: "ปริมาณต่อเลก"
  },
  "Week": {
    EN: "Week",
    TH: "สัปดาห์"
  },
  "When enabled, the optimizer automatically consolidates color rolls from later weeks into earlier shipments to resolve MOQ/MCQ gaps and eliminate surcharges.": {
    EN: "When enabled, the optimizer automatically consolidates color rolls from later weeks into earlier shipments to resolve MOQ/MCQ gaps and eliminate surcharges.",
    TH: "เมื่อเปิดใช้งาน ระบบจะรวมม้วนผ้าตามสีจากสัปดาห์ถัดไปเข้ากับชิปเมนต์ก่อนหน้าโดยอัตโนมัติ เพื่อแก้ไขช่องว่าง MOQ/MCQ และขจัดค่าธรรมเนียม"
  },
  "Your Excel file must contain these exact headers:": {
    EN: "Your Excel file must contain these exact headers:",
    TH: "ไฟล์ Excel ของคุณต้องมีหัวคอลัมน์ตรงตามนี้:"
  },
  "container-days": {
    EN: "container-days",
    TH: "ตู้-วัน"
  },
  "leg": {
    EN: "leg",
    TH: "เลก"
  },
  "legs": {
    EN: "legs",
    TH: "เลก"
  },
  "rounds the first shipment UP, then propagates excess forward to round subsequent shipments up or down.": {
    EN: "rounds the first shipment UP, then propagates excess forward to round subsequent shipments up or down.",
    TH: "ปัดชิปเมนต์แรกขึ้น แล้วกระจายส่วนเกินไปยังชิปเมนต์ถัดไปเพื่อปัดขึ้นหรือลง"
  },
  "shipments": {
    EN: "shipments",
    TH: "ชิปเมนต์"
  },
  "• Baseline: the earliest PR Due Date sets the base PO Due Date, shifted backward to the nearest allowed vendor loading day.": {
    EN: "• Baseline: the earliest PR Due Date sets the base PO Due Date, shifted backward to the nearest allowed vendor loading day.",
    TH: "• พื้นฐาน: วันครบกำหนด PR ที่เร็วที่สุดจะกำหนดวันครบกำหนด PO พื้นฐาน โดยปรับย้อนกลับไปยังวันที่อนุญาตให้โหลดสินค้าของผู้ขายที่ใกล้ที่สุด"
  },
  "• Each shipment's PO Due Date is its group's earliest PR Due Date, aligned backward to the nearest allowed loading day.": {
    EN: "• Each shipment's PO Due Date is its group's earliest PR Due Date, aligned backward to the nearest allowed loading day.",
    TH: "• วันครบกำหนด PO ของแต่ละชิปเมนต์คือวันครบกำหนด PR ที่เร็วที่สุดของกลุ่มนั้น โดยปรับย้อนกลับไปยังวันที่อนุญาตให้โหลดสินค้าที่ใกล้ที่สุด"
  },
  "• Grouping: sorted Days Early values are clustered dynamically — each group spans a rolling 7-day window from its own start date, not fixed weekly buckets.": {
    EN: "• Grouping: sorted Days Early values are clustered dynamically — each group spans a rolling 7-day window from its own start date, not fixed weekly buckets.",
    TH: "• การจัดกลุ่ม: ค่าจำนวนวันล่วงหน้าที่เรียงลำดับแล้วจะถูกจัดกลุ่มแบบไดนามิก โดยแต่ละกลุ่มครอบคลุมช่วง 7 วันแบบต่อเนื่องจากวันเริ่มต้นของตัวเอง ไม่ใช่ช่วงสัปดาห์คงที่"
  },
  "• Scenario count: the number of groups sets the maximum number of shipments (e.g. 15 groups → Scenarios 1–15).": {
    EN: "• Scenario count: the number of groups sets the maximum number of shipments (e.g. 15 groups → Scenarios 1–15).",
    TH: "• จำนวนสถานการณ์: จำนวนกลุ่มจะกำหนดจำนวนชิปเมนต์สูงสุด (เช่น 15 กลุ่ม → สถานการณ์ 1–15)"
  },
  "• Splitting: Scenario N splits at the N-1 largest gaps between groups; equal-sized gaps produce numbered variants (e.g. 2.1, 2.2).": {
    EN: "• Splitting: Scenario N splits at the N-1 largest gaps between groups; equal-sized gaps produce numbered variants (e.g. 2.1, 2.2).",
    TH: "• การแบ่ง: สถานการณ์ที่ N จะแบ่งที่ช่องว่างระหว่างกลุ่มที่มากที่สุด N-1 ช่อง ช่องว่างที่มีขนาดเท่ากันจะสร้างรูปแบบย่อย (เช่น 2.1, 2.2)"
  },

  // Dynamically-generated Error/Warning/Info flag templates (optimizer.ts).
  // Rendered with tp() using {placeholder} substitution — see messageKey/
  // messageParams and detailsKey/detailsParams on ErrorFlag.
  "flag.zeroPrice.message": {
    EN: "{itemCode} / {colorCode} has a Unit Price of $0.00",
    TH: "{itemCode} / {colorCode} มีราคาต่อหน่วยเท่ากับ $0.00"
  },
  "flag.zeroPrice.details": {
    EN: "This is likely a data entry error in the uploaded PR file. Landed cost, carrying cost, and opportunity cost for this item will be understated until corrected.",
    TH: "นี่อาจเป็นความผิดพลาดในการกรอกข้อมูลในไฟล์ PR ที่อัปโหลด ต้นทุนนำเข้ารวม ต้นทุนถือครอง และต้นทุนค่าเสียโอกาสของสินค้านี้จะต่ำกว่าความเป็นจริงจนกว่าจะได้รับการแก้ไข"
  },
  "flag.lclSameDay.message": {
    EN: "Total volume is below 19 CBM ({cbm} CBM).",
    TH: "ปริมาณรวมต่ำกว่า 19 CBM ({cbm} CBM)"
  },
  "flag.lclSameDay.details": {
    EN: "Optimized for LCL shipping: All items consolidated into a single shipment on the same day (Scenario 1) to minimize transport & handling costs.",
    TH: "ปรับให้เหมาะสมสำหรับการขนส่งแบบ LCL: รวมสินค้าทั้งหมดเป็นชิปเมนต์เดียวในวันเดียวกัน (สถานการณ์ที่ 1) เพื่อลดต้นทุนการขนส่งและการจัดการ"
  },
  "flag.containerOverloaded.message": {
    EN: "Shipment Week {week} is overloaded!",
    TH: "ชิปเมนต์สัปดาห์ที่ {week} มีน้ำหนัก/ปริมาตรเกิน!"
  },
  "flag.containerOverloaded.details": {
    EN: "CBM is {cbm} which exceeds the capacity of {capacity} CBM.",
    TH: "ปริมาตรอยู่ที่ {cbm} CBM ซึ่งเกินความจุ {capacity} CBM"
  },
  "flag.containerCloseToLimit.message": {
    EN: "Shipment Week {week} is close to container limit.",
    TH: "ชิปเมนต์สัปดาห์ที่ {week} ใกล้ถึงขีดจำกัดของตู้คอนเทนเนอร์"
  },
  "flag.containerCloseToLimit.details": {
    EN: "Over capacity by {excessCbm} CBM, within the 2.1 CBM tolerance.",
    TH: "เกินความจุ {excessCbm} CBM ซึ่งอยู่ในเกณฑ์ผ่อนผัน 2.1 CBM"
  },
  "flag.lateArrival.message": {
    EN: "Line {id} arrives LATE by {days} days!",
    TH: "รายการ {id} มาถึงล่าช้า {days} วัน!"
  },
  "flag.lateArrival.details": {
    EN: "PR Due Date: {prDate}, PO Due Date: {poDate}.",
    TH: "วันครบกำหนด PR: {prDate}, วันครบกำหนด PO: {poDate}"
  },
  "flag.mcqConflict.message": {
    EN: "MCQ Conflict for {color} ({vendor}): PR File is {prFileValue} YD vs Surcharge Rule is {surchargeValue} YD",
    TH: "ความขัดแย้งของ MCQ สำหรับ {color} ({vendor}): ไฟล์ PR ระบุ {prFileValue} หลา เทียบกับกฎค่าธรรมเนียมที่ระบุ {surchargeValue} หลา"
  },
  "flag.moqConflict.message": {
    EN: "MOQ Conflict for {vendor}: PR File is {prFileValue} YD vs Surcharge Rule is {surchargeValue} YD",
    TH: "ความขัดแย้งของ MOQ สำหรับ {vendor}: ไฟล์ PR ระบุ {prFileValue} หลา เทียบกับกฎค่าธรรมเนียมที่ระบุ {surchargeValue} หลา"
  },
  "flag.conflict.details.prFile": {
    EN: "Currently applying PR File ({value} YD). Priority defaults to Surcharge Rules unless overridden.",
    TH: "ขณะนี้ใช้ค่าจากไฟล์ PR ({value} หลา) โดยค่าเริ่มต้นจะให้ความสำคัญกับกฎค่าธรรมเนียมก่อน เว้นแต่จะถูกแทนที่"
  },
  "flag.conflict.details.surchargeRule": {
    EN: "Currently applying Surcharge Rule ({value} YD). Priority defaults to Surcharge Rules unless overridden.",
    TH: "ขณะนี้ใช้ค่าจากกฎค่าธรรมเนียม ({value} หลา) โดยค่าเริ่มต้นจะให้ความสำคัญกับกฎค่าธรรมเนียมก่อน เว้นแต่จะถูกแทนที่"
  },
  "flag.underMcq.message": {
    EN: "{color} is under MCQ ({qty}/{mcq} YD) on Shipment Date {date}",
    TH: "{color} ต่ำกว่า MCQ ({qty}/{mcq} หลา) ในวันจัดส่ง {date}"
  },
  "flag.underMcq.details": {
    EN: "Incurred MCQ penalty surcharge.",
    TH: "เกิดค่าธรรมเนียมปรับจาก MCQ"
  },
  "flag.orderUnderMoq.message": {
    EN: "Order total is under MOQ ({qty}/{moq} YD)",
    TH: "ยอดสั่งซื้อรวมต่ำกว่า MOQ ({qty}/{moq} หลา)"
  },
  "flag.orderUnderMoq.details": {
    EN: "The entire order is below the minimum order quantity requirement of {moq} YD. Total MOQ/MCQ surcharge incurred: {usd} USD ({thb} THB).",
    TH: "คำสั่งซื้อทั้งหมดต่ำกว่าจำนวนสั่งซื้อขั้นต่ำที่กำหนดไว้ {moq} หลา ค่าธรรมเนียม MOQ/MCQ รวมที่เกิดขึ้น: {usd} ดอลลาร์สหรัฐ ({thb} บาท)"
  },
  "flag.shipmentUnderMoq.message": {
    EN: "Shipment {week} total is under MOQ ({qty}/{moq} YD) on Shipment Date {date}",
    TH: "ยอดรวมชิปเมนต์ที่ {week} ต่ำกว่า MOQ ({qty}/{moq} หลา) ในวันจัดส่ง {date}"
  },
  "flag.shipmentUnderMoq.details": {
    EN: "This shipment alone falls short of the minimum order quantity requirement of {moq} YD.",
    TH: "ชิปเมนต์นี้มีจำนวนต่ำกว่าจำนวนสั่งซื้อขั้นต่ำที่กำหนดไว้ {moq} หลา"
  },
  "Per-Shipment MOQ Status": {
    EN: "Per-Shipment MOQ Status",
    TH: "สถานะ MOQ รายชิปเมนต์"
  },
  "MOQ Met": {
    EN: "MOQ Met",
    TH: "ผ่านเกณฑ์ MOQ"
  },
  "MOQ Not Met": {
    EN: "MOQ Not Met",
    TH: "ไม่ผ่านเกณฑ์ MOQ"
  },
  "MOQ Target Achieved": {
    EN: "MOQ Target Achieved",
    TH: "บรรลุเป้าหมาย MOQ"
  },
  "MOQ Target Not Met": {
    EN: "MOQ Target Not Met",
    TH: "ไม่บรรลุเป้าหมาย MOQ"
  },
  "Shipment MOQ Ratio": {
    EN: "Shipment MOQ Ratio",
    TH: "สัดส่วน MOQ ของชิปเมนต์"
  },
  "flag.shipmentMoqMetDetail": {
    EN: "This shipment is fully compliant with the minimum order quantity requirement (Target: {moq} YD, Actual: {qty} YD).",
    TH: "ชิปเมนต์นี้เป็นไปตามข้อกำหนดจำนวนสั่งซื้อขั้นต่ำ (เป้าหมาย: {moq} หลา, จำนวนจริง: {qty} หลา)"
  },
  "flag.shipmentMoqShortDetail": {
    EN: "This shipment falls short of the required minimum order quantity of {moq} YD by {shortfall} YD.",
    TH: "ชิปเมนต์นี้มีจำนวนต่ำกว่าจำนวนสั่งซื้อขั้นต่ำที่กำหนดไว้ {moq} หลา อยู่ {shortfall} หลา"
  },
  "flag.warehouseDelay.message": {
    EN: "Containers delayed by {days} days in Port Warehouse.",
    TH: "ตู้คอนเทนเนอร์ล่าช้าที่คลังสินค้าท่าเรือ {days} วัน"
  },
  "flag.warehouseDelay.details": {
    EN: "Incurred warehouse storage rent of {thb} THB.",
    TH: "เกิดค่าเช่าคลังสินค้า {thb} บาท"
  },
  "flag.manualReview.message": {
    EN: "Requires manual review! Container configuration exceeds elastic capacity limit.",
    TH: "ต้องตรวจสอบด้วยตนเอง! การจัดตู้คอนเทนเนอร์เกินขีดจำกัดความยืดหยุ่นที่กำหนด"
  },

  // Static UI strings — Deep-Dive Inspector panel
  "Deep-Dive Inspector": {
    EN: "Deep-Dive Inspector",
    TH: "แผงตรวจสอบเชิงลึก"
  },
  "flag.analyzingShipments": {
    EN: "Analyzing {count} shipments, cumulative rounding excess, and MCQ thresholds.",
    TH: "วิเคราะห์ {count} ชิปเมนต์ ส่วนเกินจากการปัดเศษสะสม และเกณฑ์ MCQ"
  },
  "Reset Assignments": {
    EN: "Reset Assignments",
    TH: "รีเซ็ตการกำหนดค่า"
  },
  "Reset manual shipment date assignments back to defaults": {
    EN: "Reset manual shipment date assignments back to defaults",
    TH: "รีเซ็ตวันที่จัดส่งที่กำหนดเองกลับเป็นค่าเริ่มต้น"
  },
  "Download Combined Excel Report": {
    EN: "Download Combined Excel Report",
    TH: "ดาวน์โหลดรายงาน Excel แบบรวม"
  },
  "One workbook with every shipment's PR lines, ordered by PO Delivery Date": {
    EN: "One workbook with every shipment's PR lines, ordered by PO Delivery Date",
    TH: "ไฟล์ Excel เดียวที่รวมรายการ PR ของทุกชิปเมนต์ เรียงตามวันที่ส่งมอบ PO"
  },
  "Download Separated Excel Report": {
    EN: "Download Separated Excel Report",
    TH: "ดาวน์โหลดรายงาน Excel แบบแยก"
  },
  "Zipping…": {
    EN: "Zipping…",
    TH: "กำลังบีบอัดไฟล์…"
  },
  "A ZIP with one workbook per shipment (named by PO Delivery Date), listing that shipment's PR Num / PR Line": {
    EN: "A ZIP with one workbook per shipment (named by PO Delivery Date), listing that shipment's PR Num / PR Line",
    TH: "ไฟล์ ZIP ที่มี Excel แยกไฟล์ต่อชิปเมนต์ (ตั้งชื่อตามวันที่ส่งมอบ PO) พร้อมรายการเลข PR / บรรทัด PR ของชิปเมนต์นั้น"
  },
  "Container Check: Approved": {
    EN: "Container Check: Approved",
    TH: "ตรวจสอบตู้คอนเทนเนอร์: อนุมัติแล้ว"
  },
  "Container Check: Manual Review Required": {
    EN: "Container Check: Manual Review Required",
    TH: "ตรวจสอบตู้คอนเทนเนอร์: ต้องตรวจสอบด้วยตนเอง"
  },
  "Landed Logistics Flagged Events & Sanity Audits": {
    EN: "Landed Logistics Flagged Events & Sanity Audits",
    TH: "เหตุการณ์ที่ถูกตั้งค่าสถานะและการตรวจสอบความถูกต้องด้านโลจิสติกส์นำเข้า"
  },
  "New unit price": {
    EN: "New unit price",
    TH: "ราคาต่อหน่วยใหม่"
  },
  "Fix Price": {
    EN: "Fix Price",
    TH: "แก้ไขราคา"
  },
  "Interactive Shipment Planning:": {
    EN: "Interactive Shipment Planning:",
    TH: "การวางแผนชิปเมนต์แบบอินเทอร์แอกทีฟ:"
  },
  "Drag and drop any materials between shipment cards to reschedule them manually, use the drop-down selector on each line, or pick a specific container mix per shipment below. The logistics engine will instantly re-calculate ocean freight container packing, MCQ surcharges, carrying penalties, and total landed costs!": {
    EN: "Drag and drop any materials between shipment cards to reschedule them manually, use the drop-down selector on each line, or pick a specific container mix per shipment below. The logistics engine will instantly re-calculate ocean freight container packing, MCQ surcharges, carrying penalties, and total landed costs!",
    TH: "ลากและวางวัตถุดิบระหว่างการ์ดชิปเมนต์เพื่อเปลี่ยนกำหนดการด้วยตนเอง ใช้ตัวเลือกแบบดรอปดาวน์ในแต่ละบรรทัด หรือเลือกชุดตู้คอนเทนเนอร์เฉพาะสำหรับแต่ละชิปเมนต์ด้านล่าง ระบบจะคำนวณการจัดตู้คอนเทนเนอร์ ค่าธรรมเนียม MCQ ค่าปรับการถือครอง และต้นทุนนำเข้ารวมใหม่ทันที!"
  },
  "BROKERAGE (Clearance)": {
    EN: "BROKERAGE (Clearance)",
    TH: "ค่าธรรมเนียมพิธีการ (Brokerage)"
  },
  "Below is the official compiled Syteline Requisition schedule for": {
    EN: "Below is the official compiled Syteline Requisition schedule for",
    TH: "ด้านล่างคือตารางกำหนดการ Requisition ของ Syteline ที่รวบรวมอย่างเป็นทางการสำหรับ"
  },
  "Capital Opportunity Cost:": {
    EN: "Capital Opportunity Cost:",
    TH: "ต้นทุนค่าเสียโอกาสของเงินทุน:"
  },
  "Carrying Cost Penalty:": {
    EN: "Carrying Cost Penalty:",
    TH: "ค่าปรับต้นทุนถือครองสินค้า:"
  },
  "Color": {
    EN: "Color",
    TH: "สี"
  },
  "Color Description": {
    EN: "Color Description",
    TH: "รายละเอียดสี"
  },
  "Cost and Freight": {
    EN: "Cost and Freight",
    TH: "ค่าขนส่งและค่าระวางเรือ (Cost and Freight)"
  },
  "Cost, Insurance & Freight": {
    EN: "Cost, Insurance & Freight",
    TH: "ค่าสินค้า ประกันภัย และค่าระวางเรือ (Cost, Insurance & Freight)"
  },
  "Customs Brokerage Dues:": {
    EN: "Customs Brokerage Dues:",
    TH: "ค่าดำเนินพิธีการศุลกากร:"
  },
  "Data Parsing Error": {
    EN: "Data Parsing Error",
    TH: "ข้อผิดพลาดในการแยกวิเคราะห์ข้อมูล"
  },
  "Days Early": {
    EN: "Days Early",
    TH: "จำนวนวันล่วงหน้า"
  },
  "Delivered Duty Paid": {
    EN: "Delivered Duty Paid",
    TH: "ส่งมอบและชำระภาษีแล้ว (Delivered Duty Paid)"
  },
  "EXWORK (Origin Local)": {
    EN: "EXWORK (Origin Local)",
    TH: "EXWORK (ต้นทาง)"
  },
  "Ex Works": {
    EN: "Ex Works",
    TH: "Ex Works (ส่งมอบที่โรงงาน)"
  },
  "FREIGHT (Ocean)": {
    EN: "FREIGHT (Ocean)",
    TH: "FREIGHT (ค่าระวางเรือ)"
  },
  "Final Qty": {
    EN: "Final Qty",
    TH: "จำนวนสุดท้าย"
  },
  "Formula: (Shipment Value ÷ 2) × Carrying Rate × (Days Early / 365)": {
    EN: "Formula: (Shipment Value ÷ 2) × Carrying Rate × (Days Early / 365)",
    TH: "สูตร: (มูลค่าชิปเมนต์ ÷ 2) × อัตราต้นทุนถือครอง × (จำนวนวันล่วงหน้า / 365)"
  },
  "Formula: Shipment Value × [ (1 + Opportunity Rate)^(Days Early / 365) − 1 ]": {
    EN: "Formula: Shipment Value × [ (1 + Opportunity Rate)^(Days Early / 365) − 1 ]",
    TH: "สูตร: มูลค่าชิปเมนต์ × [ (1 + อัตราค่าเสียโอกาส)^(จำนวนวันล่วงหน้า / 365) − 1 ]"
  },
  "Free Carrier": {
    EN: "Free Carrier",
    TH: "Free Carrier (ส่งมอบผู้ขนส่ง)"
  },
  "Free On Board": {
    EN: "Free On Board",
    TH: "Free On Board (ส่งมอบบนเรือ)"
  },
  "In keeping with Syteline standards, we output the Requisition and Line columns mapped alongside their optimized quantities and delivery structures.": {
    EN: "In keeping with Syteline standards, we output the Requisition and Line columns mapped alongside their optimized quantities and delivery structures.",
    TH: "เพื่อให้สอดคล้องกับมาตรฐาน Syteline เราแสดงคอลัมน์ Requisition และ Line ควบคู่กับจำนวนที่ปรับให้เหมาะสมและโครงสร้างการส่งมอบ"
  },
  "Inbound Manifest Status": {
    EN: "Inbound Manifest Status",
    TH: "สถานะไฟล์ PR ขาเข้า"
  },
  "Item Code": {
    EN: "Item Code",
    TH: "รหัสสินค้า"
  },
  "Item Description": {
    EN: "Item Description",
    TH: "รายละเอียดสินค้า"
  },
  "LOCAL (Dest. Local)": {
    EN: "LOCAL (Dest. Local)",
    TH: "LOCAL (ปลายทาง)"
  },
  "Line No.": {
    EN: "Line No.",
    TH: "บรรทัดที่"
  },
  "Local Port Dues & Delivery:": {
    EN: "Local Port Dues & Delivery:",
    TH: "ค่าธรรมเนียมท่าเรือปลายทางและการจัดส่ง:"
  },
  "MCQ Limit": {
    EN: "MCQ Limit",
    TH: "ขั้นต่ำ MCQ"
  },
  "No colors available": {
    EN: "No colors available",
    TH: "ไม่มีสีให้เลือก"
  },
  "Ocean Freight Tariff:": {
    EN: "Ocean Freight Tariff:",
    TH: "ค่าระวางเรือ:"
  },
  "Official Requisition Mapping Worksheet:": {
    EN: "Official Requisition Mapping Worksheet:",
    TH: "เอกสารแมปข้อมูล Requisition อย่างเป็นทางการ:"
  },
  "Opportunity Rate = WACC %": {
    EN: "Opportunity Rate = WACC %",
    TH: "อัตราค่าเสียโอกาส = ต้นทุนเงินทุนถัวเฉลี่ยถ่วงน้ำหนัก (WACC) %"
  },
  "Optimized Qty": {
    EN: "Optimized Qty",
    TH: "จำนวนที่ปรับให้เหมาะสม"
  },
  "Original Qty": {
    EN: "Original Qty",
    TH: "จำนวนเดิม"
  },
  "PO Delivery Date": {
    EN: "PO Delivery Date",
    TH: "วันที่ส่งมอบ PO"
  },
  "PO Due Date": {
    EN: "PO Due Date",
    TH: "วันครบกำหนด PO"
  },
  "PO Due Date (Arrival at VT)": {
    EN: "PO Due Date (Arrival at VT)",
    TH: "วันครบกำหนด PO (ถึง VT)"
  },
  "PR Delivery Date (Vendor Loading)": {
    EN: "PR Delivery Date (Vendor Loading)",
    TH: "วันที่ส่งมอบ PR (โหลดสินค้าที่ผู้ขาย)"
  },
  "PR Due Date": {
    EN: "PR Due Date",
    TH: "วันครบกำหนด PR"
  },
  "PR ID": {
    EN: "PR ID",
    TH: "เลขที่ PR"
  },
  "PR lines": {
    EN: "PR lines",
    TH: "รายการ PR"
  },
  "Requisition No.": {
    EN: "Requisition No.",
    TH: "เลขที่ Requisition"
  },
  "Rounding/MOQ Excess": {
    EN: "Rounding/MOQ Excess",
    TH: "ส่วนเกินจากการปัดเศษ/MOQ"
  },
  "Shipment Value = Material Cost + MOQ Excess Cost": {
    EN: "Shipment Value = Material Cost + MOQ Excess Cost",
    TH: "มูลค่าชิปเมนต์ = ต้นทุนวัตถุดิบ + ต้นทุนส่วนเกิน MOQ"
  },
  "Subtotal Cost:": {
    EN: "Subtotal Cost:",
    TH: "ยอดรวมย่อย:"
  },
  "Total CBM Volume": {
    EN: "Total CBM Volume",
    TH: "ปริมาตร CBM รวม"
  },
  "Total Material Cost": {
    EN: "Total Material Cost",
    TH: "ต้นทุนวัตถุดิบรวม"
  },
  "Total Ordered Quantity": {
    EN: "Total Ordered Quantity",
    TH: "จำนวนสั่งซื้อรวม"
  },
  "Qty Original PR": {
    EN: "Qty Original PR",
    TH: "จำนวนตาม PR เดิม"
  },
  "Qty PO": {
    EN: "Qty PO",
    TH: "จำนวนตาม PO"
  },
  "UOM": {
    EN: "UOM",
    TH: "หน่วยนับ"
  },
  "Vendor Pays": {
    EN: "Vendor Pays",
    TH: "ผู้ขายเป็นผู้จ่าย"
  },
  "We Pay (Buyer)": {
    EN: "We Pay (Buyer)",
    TH: "เราเป็นผู้จ่าย (ผู้ซื้อ)"
  },
  "You have successfully loaded": {
    EN: "You have successfully loaded",
    TH: "คุณโหลดข้อมูลสำเร็จแล้ว"
  },
  "from your Syteline procurement sheet. You can use the sidebar or click below to configure logistics rates & custom route quotes.": {
    EN: "from your Syteline procurement sheet. You can use the sidebar or click below to configure logistics rates & custom route quotes.",
    TH: "จากไฟล์จัดซื้อ Syteline ของคุณ คุณสามารถใช้แถบด้านข้างหรือคลิกด้านล่างเพื่อกำหนดค่าอัตราโลจิสติกส์และใบเสนอราคาเส้นทางที่กำหนดเอง"
  },
  "Loading…": {
    EN: "Loading…",
    TH: "กำลังโหลด…"
  },
};

export function t(key: string, lang: Language): string {
  if (translations[key] && translations[key][lang]) {
    return translations[key][lang];
  }
  return key;
}

// Translate a template string with {placeholder} tokens, substituting values
// from `params`. Falls back gracefully: missing params leave the token as-is
// rather than throwing, and an unknown key falls back to the raw key (same
// behavior as `t()`) before substitution is attempted.
export function tp(key: string, params: Record<string, string | number> | undefined, lang: Language): string {
  const template = t(key, lang);
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, paramName) => {
    const val = params[paramName];
    return val !== undefined && val !== null ? String(val) : match;
  });
}
