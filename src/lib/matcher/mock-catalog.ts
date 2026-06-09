import type { CatalogEntry } from './types'

/**
 * 80-item mock catalog of realistic wholesale product variants.
 * Used in Phase 2 (Issues #3–#8) before the live Shopify catalog is available.
 * Deleted in Issue #11 when the live sku_mappings table takes over.
 */
export const MOCK_CATALOG: CatalogEntry[] = [
  // Auto Parts
  { variantId: 'var_001', sku: 'BP-20-4789', productTitle: 'Brake Pad Set', variantTitle: 'Front', currentCost: 18.50, currentPrice: 42.99 },
  { variantId: 'var_002', sku: 'BP-20-4790', productTitle: 'Brake Pad Set', variantTitle: 'Rear', currentCost: 16.00, currentPrice: 37.99 },
  { variantId: 'var_003', sku: 'OF-12345', productTitle: 'Oil Filter', variantTitle: 'Standard', currentCost: 4.20, currentPrice: 11.99 },
  { variantId: 'var_004', sku: 'OF-12346', productTitle: 'Oil Filter', variantTitle: 'Premium', currentCost: 6.50, currentPrice: 16.99 },
  { variantId: 'var_005', sku: 'AF-77891', productTitle: 'Air Filter', variantTitle: 'Panel', currentCost: 8.00, currentPrice: 19.99 },
  { variantId: 'var_006', sku: 'SP-IRIDIUM-4', productTitle: 'Spark Plug', variantTitle: 'Iridium', currentCost: 7.20, currentPrice: 16.99 },
  { variantId: 'var_007', sku: 'SP-COPPER-4', productTitle: 'Spark Plug', variantTitle: 'Copper', currentCost: 2.80, currentPrice: 6.99 },
  { variantId: 'var_008', sku: 'WT-SERPENTINE-6', productTitle: 'Serpentine Belt', variantTitle: '6-Rib', currentCost: 12.00, currentPrice: 28.99 },
  { variantId: 'var_009', sku: 'CB-HEAVY-25', productTitle: 'Jumper Cables', variantTitle: '25ft Heavy Duty', currentCost: 14.50, currentPrice: 34.99 },
  { variantId: 'var_010', sku: 'WW-24A', productTitle: 'Wiper Blade', variantTitle: '24 inch', currentCost: 5.50, currentPrice: 13.99 },
  // Electronics
  { variantId: 'var_011', sku: 'USB-C-12W', productTitle: 'USB-C Charger', variantTitle: '12W', currentCost: 4.80, currentPrice: 12.99 },
  { variantId: 'var_012', sku: 'USB-C-20W', productTitle: 'USB-C Charger', variantTitle: '20W', currentCost: 7.20, currentPrice: 19.99 },
  { variantId: 'var_013', sku: 'HDMI-6FT', productTitle: 'HDMI Cable', variantTitle: '6ft', currentCost: 3.50, currentPrice: 9.99 },
  { variantId: 'var_014', sku: 'HDMI-10FT', productTitle: 'HDMI Cable', variantTitle: '10ft', currentCost: 5.00, currentPrice: 13.99 },
  { variantId: 'var_015', sku: 'PWR-STRIP-6', productTitle: 'Power Strip', variantTitle: '6 Outlet', currentCost: 8.00, currentPrice: 19.99 },
  { variantId: 'var_016', sku: 'EXT-CAT6-25', productTitle: 'Cat6 Cable', variantTitle: '25ft', currentCost: 6.00, currentPrice: 15.99 },
  { variantId: 'var_017', sku: 'EXT-CAT6-50', productTitle: 'Cat6 Cable', variantTitle: '50ft', currentCost: 9.50, currentPrice: 24.99 },
  { variantId: 'var_018', sku: 'SD-CARD-64', productTitle: 'SD Card', variantTitle: '64GB', currentCost: 7.00, currentPrice: 18.99 },
  { variantId: 'var_019', sku: 'SD-CARD-128', productTitle: 'SD Card', variantTitle: '128GB', currentCost: 11.00, currentPrice: 27.99 },
  { variantId: 'var_020', sku: 'MOUSE-WRLS-BLK', productTitle: 'Wireless Mouse', variantTitle: 'Black', currentCost: 12.00, currentPrice: 29.99 },
  // Hardware / Fasteners
  { variantId: 'var_021', sku: 'SCR-M4-50', productTitle: 'M4 Screw', variantTitle: '50mm 100pk', currentCost: 2.50, currentPrice: 7.99 },
  { variantId: 'var_022', sku: 'SCR-M6-30', productTitle: 'M6 Screw', variantTitle: '30mm 50pk', currentCost: 2.00, currentPrice: 5.99 },
  { variantId: 'var_023', sku: 'NUT-M4', productTitle: 'M4 Nut', variantTitle: '100pk', currentCost: 1.50, currentPrice: 4.99 },
  { variantId: 'var_024', sku: 'NUT-M6', productTitle: 'M6 Nut', variantTitle: '50pk', currentCost: 1.80, currentPrice: 5.49 },
  { variantId: 'var_025', sku: 'WSHR-FLAT-M4', productTitle: 'Flat Washer M4', variantTitle: '200pk', currentCost: 1.20, currentPrice: 3.99 },
  { variantId: 'var_026', sku: 'ANCR-WALL-6MM', productTitle: 'Wall Anchor', variantTitle: '6mm 50pk', currentCost: 3.00, currentPrice: 8.99 },
  { variantId: 'var_027', sku: 'NAIL-FRAMING-3', productTitle: 'Framing Nail', variantTitle: '3in 1lb', currentCost: 4.00, currentPrice: 10.99 },
  // Pet Supplies
  { variantId: 'var_028', sku: 'DOG-FOOD-SM-15', productTitle: 'Dry Dog Food', variantTitle: 'Small Breed 15lb', currentCost: 18.00, currentPrice: 42.99 },
  { variantId: 'var_029', sku: 'DOG-FOOD-LG-30', productTitle: 'Dry Dog Food', variantTitle: 'Large Breed 30lb', currentCost: 32.00, currentPrice: 74.99 },
  { variantId: 'var_030', sku: 'CAT-LITTER-20', productTitle: 'Clumping Litter', variantTitle: '20lb', currentCost: 9.00, currentPrice: 22.99 },
  { variantId: 'var_031', sku: 'PET-COLLAR-S', productTitle: 'Dog Collar', variantTitle: 'Small', currentCost: 4.50, currentPrice: 12.99 },
  { variantId: 'var_032', sku: 'PET-COLLAR-M', productTitle: 'Dog Collar', variantTitle: 'Medium', currentCost: 5.50, currentPrice: 14.99 },
  { variantId: 'var_033', sku: 'PET-LEASH-6FT', productTitle: 'Dog Leash', variantTitle: '6ft', currentCost: 6.00, currentPrice: 15.99 },
  // Beauty / Personal Care
  { variantId: 'var_034', sku: 'SHMP-200ML', productTitle: 'Shampoo', variantTitle: '200ml', currentCost: 3.50, currentPrice: 9.99 },
  { variantId: 'var_035', sku: 'COND-200ML', productTitle: 'Conditioner', variantTitle: '200ml', currentCost: 3.80, currentPrice: 10.99 },
  { variantId: 'var_036', sku: 'FACE-WASH-100ML', productTitle: 'Face Wash', variantTitle: '100ml', currentCost: 5.00, currentPrice: 13.99 },
  { variantId: 'var_037', sku: 'SPF-50-75ML', productTitle: 'Sunscreen SPF50', variantTitle: '75ml', currentCost: 6.50, currentPrice: 16.99 },
  // Office Supplies
  { variantId: 'var_038', sku: 'PEN-BLK-10PK', productTitle: 'Ballpoint Pen', variantTitle: 'Black 10pk', currentCost: 1.80, currentPrice: 5.99 },
  { variantId: 'var_039', sku: 'PEN-BLU-10PK', productTitle: 'Ballpoint Pen', variantTitle: 'Blue 10pk', currentCost: 1.80, currentPrice: 5.99 },
  { variantId: 'var_040', sku: 'NOTEBOOK-A5', productTitle: 'Notebook', variantTitle: 'A5 Ruled', currentCost: 2.50, currentPrice: 7.99 },
  { variantId: 'var_041', sku: 'NOTEBOOK-A4', productTitle: 'Notebook', variantTitle: 'A4 Ruled', currentCost: 3.20, currentPrice: 8.99 },
  { variantId: 'var_042', sku: 'TAPE-CLEAR-25M', productTitle: 'Clear Tape', variantTitle: '25m 3pk', currentCost: 2.00, currentPrice: 5.49 },
  { variantId: 'var_043', sku: 'STAPLER-STD', productTitle: 'Stapler', variantTitle: 'Standard', currentCost: 4.50, currentPrice: 11.99 },
  { variantId: 'var_044', sku: 'STAPLES-1M', productTitle: 'Staples', variantTitle: '1000pk', currentCost: 1.20, currentPrice: 3.49 },
  // Cleaning Supplies
  { variantId: 'var_045', sku: 'BLEACH-1L', productTitle: 'Bleach', variantTitle: '1L', currentCost: 1.50, currentPrice: 4.99 },
  { variantId: 'var_046', sku: 'MOP-BUCKET', productTitle: 'Mop & Bucket Set', variantTitle: 'Standard', currentCost: 12.00, currentPrice: 29.99 },
  { variantId: 'var_047', sku: 'TRASH-13GAL-50', productTitle: 'Trash Bags', variantTitle: '13 Gal 50pk', currentCost: 5.00, currentPrice: 13.99 },
  { variantId: 'var_048', sku: 'TRASH-33GAL-30', productTitle: 'Trash Bags', variantTitle: '33 Gal 30pk', currentCost: 7.50, currentPrice: 19.99 },
  // Tools
  { variantId: 'var_049', sku: 'SCRDRV-PH2', productTitle: 'Screwdriver', variantTitle: 'Phillips PH2', currentCost: 3.00, currentPrice: 8.99 },
  { variantId: 'var_050', sku: 'SCRDRV-SET-6', productTitle: 'Screwdriver Set', variantTitle: '6 Piece', currentCost: 9.50, currentPrice: 24.99 },
  { variantId: 'var_051', sku: 'HAMMER-16OZ', productTitle: 'Claw Hammer', variantTitle: '16oz', currentCost: 8.00, currentPrice: 21.99 },
  { variantId: 'var_052', sku: 'TAPE-MEASURE-25', productTitle: 'Tape Measure', variantTitle: '25ft', currentCost: 7.00, currentPrice: 18.99 },
  { variantId: 'var_053', sku: 'LEVEL-24IN', productTitle: 'Spirit Level', variantTitle: '24 inch', currentCost: 10.00, currentPrice: 25.99 },
  // Industrial / MRO
  { variantId: 'var_054', sku: 'GLOVES-NITR-M', productTitle: 'Nitrile Gloves', variantTitle: 'Medium 100pk', currentCost: 8.50, currentPrice: 22.99 },
  { variantId: 'var_055', sku: 'GLOVES-NITR-L', productTitle: 'Nitrile Gloves', variantTitle: 'Large 100pk', currentCost: 8.50, currentPrice: 22.99 },
  { variantId: 'var_056', sku: 'SAFETY-GLASSES', productTitle: 'Safety Glasses', variantTitle: 'Clear Lens', currentCost: 2.00, currentPrice: 5.99 },
  { variantId: 'var_057', sku: 'EARPLUGS-200PR', productTitle: 'Ear Plugs', variantTitle: '200 pair', currentCost: 12.00, currentPrice: 29.99 },
  { variantId: 'var_058', sku: 'MASK-N95-20PK', productTitle: 'N95 Mask', variantTitle: '20pk', currentCost: 15.00, currentPrice: 38.99 },
  { variantId: 'var_059', sku: 'CAUTION-TAPE-1K', productTitle: 'Caution Tape', variantTitle: '1000ft', currentCost: 5.00, currentPrice: 12.99 },
  { variantId: 'var_060', sku: 'PALLET-WRAP-18', productTitle: 'Stretch Wrap', variantTitle: '18in x 1500ft', currentCost: 18.00, currentPrice: 44.99 },
  // Vape / CBD (common dropship niche)
  { variantId: 'var_061', sku: 'CBD-OIL-500MG', productTitle: 'CBD Oil', variantTitle: '500mg 30ml', currentCost: 14.00, currentPrice: 34.99 },
  { variantId: 'var_062', sku: 'CBD-OIL-1000MG', productTitle: 'CBD Oil', variantTitle: '1000mg 30ml', currentCost: 22.00, currentPrice: 54.99 },
  { variantId: 'var_063', sku: 'VAPE-DEVICE-BLK', productTitle: 'Pod Device', variantTitle: 'Black', currentCost: 10.00, currentPrice: 24.99 },
  { variantId: 'var_064', sku: 'VAPE-DEVICE-WHT', productTitle: 'Pod Device', variantTitle: 'White', currentCost: 10.00, currentPrice: 24.99 },
  // Kitchen
  { variantId: 'var_065', sku: 'KNIFE-CHEF-8', productTitle: 'Chef Knife', variantTitle: '8 inch', currentCost: 16.00, currentPrice: 39.99 },
  { variantId: 'var_066', sku: 'KNIFE-PARING', productTitle: 'Paring Knife', variantTitle: '3.5 inch', currentCost: 5.50, currentPrice: 14.99 },
  { variantId: 'var_067', sku: 'CUTTING-BOARD-L', productTitle: 'Cutting Board', variantTitle: 'Large Bamboo', currentCost: 9.00, currentPrice: 22.99 },
  { variantId: 'var_068', sku: 'BOWL-MIXING-3PC', productTitle: 'Mixing Bowl Set', variantTitle: '3pc Stainless', currentCost: 12.00, currentPrice: 29.99 },
  { variantId: 'var_069', sku: 'STORAGE-1L', productTitle: 'Food Container', variantTitle: '1L', currentCost: 2.50, currentPrice: 6.99 },
  { variantId: 'var_070', sku: 'STORAGE-2L', productTitle: 'Food Container', variantTitle: '2L', currentCost: 3.50, currentPrice: 8.99 },
  // Sporting Goods
  { variantId: 'var_071', sku: 'YOGA-MAT-PURPLE', productTitle: 'Yoga Mat', variantTitle: 'Purple', currentCost: 10.00, currentPrice: 24.99 },
  { variantId: 'var_072', sku: 'YOGA-MAT-BLACK', productTitle: 'Yoga Mat', variantTitle: 'Black', currentCost: 10.00, currentPrice: 24.99 },
  { variantId: 'var_073', sku: 'RESISTANCE-BAND-M', productTitle: 'Resistance Band', variantTitle: 'Medium', currentCost: 4.00, currentPrice: 11.99 },
  { variantId: 'var_074', sku: 'RESISTANCE-BAND-H', productTitle: 'Resistance Band', variantTitle: 'Heavy', currentCost: 5.00, currentPrice: 13.99 },
  { variantId: 'var_075', sku: 'JUMP-ROPE-SPEED', productTitle: 'Jump Rope', variantTitle: 'Speed', currentCost: 6.00, currentPrice: 15.99 },
  // Garden
  { variantId: 'var_076', sku: 'HOSE-50FT', productTitle: 'Garden Hose', variantTitle: '50ft', currentCost: 18.00, currentPrice: 44.99 },
  { variantId: 'var_077', sku: 'TROWEL-SS', productTitle: 'Garden Trowel', variantTitle: 'Stainless', currentCost: 5.00, currentPrice: 13.99 },
  { variantId: 'var_078', sku: 'PRUNER-BYPASS', productTitle: 'Pruning Shears', variantTitle: 'Bypass', currentCost: 8.00, currentPrice: 19.99 },
  { variantId: 'var_079', sku: 'PLANT-FOOD-16OZ', productTitle: 'Plant Food', variantTitle: '16oz Concentrate', currentCost: 5.50, currentPrice: 14.99 },
  { variantId: 'var_080', sku: 'SEED-TRAY-72', productTitle: 'Seed Tray', variantTitle: '72 Cell', currentCost: 3.00, currentPrice: 7.99 },
]
