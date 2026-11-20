# -*- coding: utf-8 -*-
"""Catalog of the Sixty5 cost plan: roles, products, expense items, suppliers.
Prices: EUR, excl. VAT, level 2026 (Dutch trade prices). Anchors found on the web on 2026-11-20 (see README.md):
  Wüpor 100 mm aircrete block 18.33 EUR/m2 incl. VAT at Hornbach (15.15 net), calcium-silicate L120 block 31-36 EUR/m2 incl. VAT, PIR 100 mm ~28 EUR/m2 incl. VAT,
  Gyproc 12.5 mm board 4-10 EUR/m2, partition installed 40-75 EUR/m2, aluminium frame + HR++ installed 480-950 EUR/m2, freelance rates 45-61 EUR/h,
  crane operator 45-60 EUR/h. Everything else = estimate of a building economist (kengetallen)."""

ID = 'bld-'          # every row this plan makes has an id that starts with it

# ---- units (all exist, but m3) -----------------------------------------------------------------------------
NEW_UNITS = [('unit_m3', 'm³', '113', 13000)]

# ---- suppliers (fictional Dutch companies) -----------------------------------------------------------------
SUPPLIERS = {
    'hbh':  ('Hollandse Bouwstoffen Handel B.V.', 'Rotterdam', 'blocks, mortar, anchors, small material'),
    'nmd':  ('Nieuwe Maas Droogbouw Groothandel B.V.', 'Schiedam', 'plasterboard, metal stud, ceilings'),
    'dit':  ('Delta Isolatie Techniek B.V.', 'Dordrecht', 'PIR and mineral wool insulation, roof insulation'),
    'rpb':  ('Rijnmond Prefab Beton B.V.', 'Alblasserdam', 'precast concrete'),
    'alu':  ('Aluvision Gevelsystemen B.V.', 'Capelle aan den IJssel', 'aluminium frames, curtain walls, trims'),
    'vdb':  ('Van den Berg Kozijnen & Deuren B.V.', 'Zwijndrecht', 'frames, doors, hardware'),
    'kar':  ('Keukenatelier Randstad B.V.', 'Zoetermeer', 'kitchens, appliances'),
    'scr':  ('Sanitair Centrum Rotterdam B.V.', 'Rotterdam', 'sanitary, cisterns, drains'),
    'egz':  ('Elektrogroothandel Zuid-Holland B.V.', 'Barendrecht', 'luminaires, meter cupboards'),
    'mst':  ('Maasstad Staalhandel B.V.', 'Vlaardingen', 'steel, anchor channels, balustrades'),
    'tvl':  ('Tegelhuis Vlaardingen B.V.', 'Vlaardingen', 'tiles, artificial stone'),
    'mcm':  ('Mortelcentrale Maasvlakte B.V.', 'Rotterdam', 'screed mortar'),
    'hku':  ('Houthandel Kuipers B.V.', 'Gouda', 'timber, plywood'),
    'dmn':  ('Dakmaterialen Nederland B.V.', 'Nieuwegein', 'roofing, tapered insulation'),
    'hkr':  ('Hijs- en Kraanverhuur Rijnmond B.V.', 'Rotterdam', 'tower crane, hoist'),
    'sth':  ('Steiger- en Hoogwerkverhuur Zuid B.V.', 'Spijkenisse', 'facade access, platforms'),
    'afv':  ('Afvalverwerking Rotterdam B.V.', 'Rotterdam', 'waste containers'),
    'bvr':  ('Boorbedrijf Van Rijn B.V.', 'Barendrecht', 'core drilling, sawing'),
    'tpv':  ('Tooling & Plant Verhuur B.V.', 'Ridderkerk', 'small plant, consumables'),
    'ckw':  ('Controle- en Keuringsbureau Waterweg B.V.', 'Maassluis', 'site surveying, testing'),
}

# ---- Time roles: key -> (title, EUR/hour cost of the hour, description) ------------------------------------------
ROLES_TIME = {
    'site-manager':   ('Uitvoerder (site manager)', 74.0, 'Leads the site team of a trade, plans work, checks quality and safety'),
    'foreman':        ('Voorman (foreman)', 59.0, 'Leads a crew, sets out the work, checks the result'),
    'bricklayer':     ('Metselaar (bricklayer, block walls)', 51.0, 'Builds block walls with thin-bed mortar'),
    'cs-fitter':      ('Kalkzandsteenmonteur (CS element fitter)', 52.0, 'Fits glued calcium-silicate elements with the crane'),
    'concrete-fitter':('Betonmonteur (precast concrete fitter)', 55.0, 'Hoists and fixes precast concrete elements'),
    'facade-fitter':  ('Gevelmonteur (facade fitter)', 56.0, 'Fits facade claddings, insulation and anchors'),
    'frame-fitter':   ('Kozijnmonteur (frame and glazing fitter)', 54.0, 'Sets aluminium frames, windows, curtain walls and doors'),
    'carpenter':      ('Timmerman (carpenter)', 52.0, 'Timber work, plywood, hardware, interior joinery'),
    'drywaller':      ('Afbouwer droogbouw (drywall fitter)', 49.0, 'Metal stud partitions, plasterboard, ceilings, finishing joints'),
    'screeder':       ('Dekvloerlegger (screed layer)', 47.0, 'Pumps and levels floor screeds'),
    'tiler':          ('Tegelzetter (tiler)', 50.0, 'Sets floor and wall tiles'),
    'plumber':        ('Loodgieter (plumber)', 58.0, 'Sanitary, cisterns, drains, water pipes'),
    'electrician':    ('Elektromonteur (electrician)', 57.0, 'Meter cupboards, luminaires, wiring'),
    'kitchen-fitter': ('Keukenmonteur (kitchen and appliance fitter)', 53.0, 'Fits kitchens and appliances'),
    'steel-fitter':   ('Constructiebankwerker (steel fitter)', 58.0, 'Steel parts, anchor channels, railings, stairs'),
    'insulator':      ('Isoleerder (insulation fitter)', 48.0, 'Cavity, roof and acoustic insulation'),
    'roofer':         ('Dakdekker (roofer)', 52.0, 'Roof insulation and roof covering'),
    'painter':        ('Schilder (painter)', 46.0, 'Paint, filler and spray work'),
    'labourer':       ('Opperman (labourer)', 41.0, 'Helps the trades: carrying, mixing, cleaning'),
}

# ---- Material categories (= one role each) ------------------------------------------------------------------
MAT_CATS = {
    'blocks':   'Blokken en metselwerk (blocks and masonry)',
    'mortar':   'Mortels, lijmen en dekvloeren (mortar, glue, screed)',
    'insul':    'Isolatiematerialen (insulation)',
    'board':    'Plaatmateriaal en droogbouw (boards and drywall)',
    'prefab':   'Prefab beton (precast concrete)',
    'frames':   'Kozijnen, ramen en puien (frames, windows, curtain walls)',
    'doors':    'Deuren en hang- en sluitwerk (doors and hardware)',
    'steel':    'Staal, aluminium en hekwerken (steel, aluminium, railings)',
    'finish':   'Vloer- en wandafwerking (floor and wall finishes)',
    'sanitary': 'Sanitair en afvoer (sanitary and drains)',
    'electro':  'Elektra en verlichting (electrical and luminaires)',
    'kitchen':  'Keukens en apparatuur (kitchens and appliances)',
    'timber':   'Hout en plaathout (timber and plywood)',
    'roof':     'Dakmaterialen (roof materials)',
    'misc':     'Hulpmateriaal (small material)',
}
EXP_CATS = {
    'hire':    'Verhuur materieel (plant hire)',
    'service': 'Diensten en afvoer (services and waste)',
    'site':    'Bouwplaatskosten (site costs)',
}

# ---- Material products: key -> (title, itemNumber, unit, price EUR, supplier, category, budget item, note) -----
# unit ids: unit_m2 unit_m unit_pcs unit_kg unit_m3
MAT = {
    # blocks and mortar
    'ytong100':  ('Ytong cellenbetonblok G4/600 100 mm (600×250)', 'YTG-G4-100', 'unit_m2', 15.20, 'hbh', 'blocks', 'Aircrete partition block 100 mm, 6.67 blocks/m2'),
    'ytong120':  ('Ytong cellenbetonblok G4/600 120 mm', 'YTG-G4-120', 'unit_m2', 18.10, 'hbh', 'blocks', 'Aircrete block 120 mm'),
    'ytong150':  ('Ytong cellenbetonblok G4/600 150 mm', 'YTG-G4-150', 'unit_m2', 22.60, 'hbh', 'blocks', 'Aircrete block 150 mm'),
    'ytongmort': ('Ytong dunbedmortel (lijm) zak 25 kg', 'YTG-LIJM-25', 'unit_kg', 0.70, 'hbh', 'mortar', 'Thin-bed mortar for aircrete, 1.4 kg/m2 of a 100 mm wall'),
    'cs100':     ('Kalkzandsteen lijmelement CS 100 mm', 'KZS-CS-100', 'unit_m2', 24.50, 'hbh', 'blocks', 'Calcium-silicate glued element 100 mm, delivered per m2 of wall'),
    'cs120':     ('Kalkzandsteen lijmelement CS 120 mm', 'KZS-CS-120', 'unit_m2', 28.50, 'hbh', 'blocks', 'Calcium-silicate glued element 120 mm'),
    'cs150':     ('Kalkzandsteen lijmelement CS 150 mm', 'KZS-CS-150', 'unit_m2', 34.50, 'hbh', 'blocks', 'Calcium-silicate glued element 150 mm'),
    'csglue':    ('Kalkzandsteen elementenlijm zak 25 kg', 'KZS-LIJM-25', 'unit_kg', 0.62, 'hbh', 'mortar', 'Glue for CS elements, 1.1 kg/m2'),
    'wallanchor':('Spouwanker RVS 4 mm (set)', 'ANK-RVS-4', 'unit_pcs', 0.46, 'hbh', 'misc', 'Stainless cavity tie'),
    'sealant':   ('Voegkit, purschuim en montagemateriaal (per m2 wand)', 'MON-SET-01', 'unit_m2', 1.60, 'hbh', 'misc', 'Sealant, PU foam, plugs'),
    # insulation: price per thickness is computed in the rules, these are the catalogue items
    'acoustic25':('Contactgeluidisolatie 25 mm onder dekvloer', 'AKO-CG-25', 'unit_m2', 6.90, 'dit', 'insul', 'Impact sound insulation under screed'),
    'roofins':   ('Hellend afgeschoven dakisolatie PIR (gemiddeld 200 mm)', 'DAK-PIR-AFS', 'unit_m2', 48.0, 'dmn', 'roof', 'Tapered PIR roof insulation'),
    'roofcover': ('Bitumineuze dakbedekking 2-laags, gerecycled leisteen', 'DAK-BIT-2L', 'unit_m2', 36.0, 'dmn', 'roof', 'Two-layer bitumen roof covering'),
    'loggiains': ('PIR isolatie loggiavloer 180 mm', 'PIR-LOG-180', 'unit_m2', 42.0, 'dit', 'roof', 'PIR 180 mm, loggia floors'),
    # boards
    'board125':  ('Gyproc gipsplaat 12,5 mm standaard', 'GYP-125', 'unit_m2', 5.20, 'nmd', 'board', 'Standard plasterboard 12.5 mm'),
    'board125f': ('Gyproc brandwerende plaat GKF 12,5 mm', 'GYP-GKF-125', 'unit_m2', 7.40, 'nmd', 'board', 'Fire-rated board'),
    'board125w': ('Gyproc vochtwerende plaat 12,5 mm (badkamer)', 'GYP-GKI-125', 'unit_m2', 9.80, 'nmd', 'board', 'Moisture-resistant board for bathrooms'),
    'board10':   ('Gyproc gipsplaat 10 mm', 'GYP-100', 'unit_m2', 4.35, 'nmd', 'board', 'Plasterboard 10 mm'),
    'board13':   ('Gyproc gipsplaat 13 mm hoge dichtheid', 'GYP-130', 'unit_m2', 6.60, 'nmd', 'board', 'Plasterboard 13 mm'),
    'board20':   ('Gyproc gipsplaat 2×10 mm (20 mm pakket)', 'GYP-200', 'unit_m2', 8.60, 'nmd', 'board', 'Plasterboard 20 mm'),
    'promatect': ('Promatect brandwerende plaat 20 mm', 'PRO-PT-20', 'unit_m2', 41.0, 'nmd', 'board', 'Calcium-silicate fire board 20 mm'),
    'stud75':    ('Metalstud profielen C75 + U75 (set per m2 wand)', 'MST-C75', 'unit_m2', 5.40, 'nmd', 'board', 'C and U studs for 1 m2 of partition'),
    'ceilsys':   ('Plafondophangsysteem CD60 met hangers (per m2)', 'PLF-CD60', 'unit_m2', 6.20, 'nmd', 'board', 'Ceiling suspension system'),
    'woolpart':  ('Steenwol wandisolatie 70 mm akoestisch', 'WOOL-AK-70', 'unit_m2', 5.30, 'dit', 'insul', 'Acoustic mineral wool in partitions'),
    'jointset':  ('Voegenvuller, voegband, schroeven en hoekprofielen (per m2)', 'GYP-VOEG', 'unit_m2', 1.55, 'nmd', 'board', 'Joint filler, tape, screws, corner beads'),
    'filler':    ('Spackspuitmassa en primer (per m2)', 'SPK-PRM', 'unit_m2', 1.35, 'nmd', 'board', 'Finishing filler and primer'),
    # prefab
    'pfacade':   ('Prefab betonnen gevelelement sandwich 70-100-100', 'PRF-GEV-SW', 'unit_m2', 265.0, 'rpb', 'prefab', 'Precast sandwich facade element, delivered to site'),
    'pedge':     ('Prefab betonnen randelement 130 mm', 'PRF-RAND-130', 'unit_m2', 295.0, 'rpb', 'prefab', 'Precast edge element'),
    'pbeamm3':   ('Prefab betonnen ligger / vloerdeel (per m3)', 'PRF-LIG-M3', 'unit_m3', 640.0, 'rpb', 'prefab', 'Precast beam / balcony slab per m3, incl. rebar'),
    'plintel':   ('Prefab betonnen latei / onderdorpel', 'PRF-LAT', 'unit_pcs', 420.0, 'rpb', 'prefab', 'Precast lintel'),
    'psill':     ('Onderdorpel pui, natuursteen-look beton 230×75', 'PRF-DORP', 'unit_pcs', 88.0, 'rpb', 'prefab', 'Concrete sill'),
    'prailing':  ('Prefab betonnen balkonborstwering', 'PRF-BORST', 'unit_pcs', 185.0, 'rpb', 'prefab', 'Precast balcony parapet'),
    'pstair':    ('Prefab betonnen trap (steektrap met bordes)', 'PRF-TRAP', 'unit_pcs', 2850.0, 'rpb', 'prefab', 'Precast stair flight with landing'),
    'psteelstair':('Stalen spiltrap met betonnen treden', 'STL-TRAP-BET', 'unit_pcs', 18500.0, 'mst', 'steel', 'Steel stair with concrete treads'),
    # frames and doors
    'alukozijn': ('Aluminium gevelkozijn thermisch onderbroken incl. HR++ beglazing', 'ALU-KZ-HRPP', 'unit_m2', 585.0, 'alu', 'frames', 'Aluminium frame + HR++ glazing, supply only'),
    'alupui':    ('Aluminium pui / raam met HR++ beglazing en beslag', 'ALU-PUI-HRPP', 'unit_m2', 640.0, 'alu', 'frames', 'Curtain wall / window with glazing, supply only'),
    'stelkozijn':('Stelkozijn aluminium thermisch onderbroken (dagmaat)', 'ALU-STEL', 'unit_m2', 245.0, 'alu', 'frames', 'Aluminium rough frame, supply only'),
    'roofwindow':('Lichtkoepel / dakraam 90×90 vast HR++', 'DAK-RAAM-90', 'unit_pcs', 1850.0, 'dmn', 'roof', 'Roof window'),
    'doorint':   ('Binnendeur opdek met stalen kozijn en hang- en sluitwerk', 'DEUR-BIN-STK', 'unit_pcs', 395.0, 'vdb', 'doors', 'Interior door set with steel frame'),
    'doorint2':  ('Binnendeur stomp met stalen kozijn (bijkeuken / meterkast)', 'DEUR-BIN-ST2', 'unit_pcs', 365.0, 'vdb', 'doors', 'Interior door set'),
    'doorfire':  ('Brandwerende woningentreedeur WBDBO 30 minuten met kozijn', 'DEUR-WBDBO30', 'unit_pcs', 1120.0, 'vdb', 'doors', 'Fire-rated apartment entrance door'),
    'doorloggia':('Aluminium loggia-deur met HR++ glas', 'ALU-DEUR-LOG', 'unit_pcs', 860.0, 'alu', 'doors', 'Loggia door'),
    'doordbl':   ('Aluminium dubbele draaideur met HR++ glas', 'ALU-DEUR-DBL', 'unit_pcs', 1420.0, 'alu', 'doors', 'Double casement'),
    'doorentry': ('Aluminium entreepui dubbel met sluitwerk', 'ALU-ENTREE', 'unit_pcs', 2450.0, 'alu', 'doors', 'Entrance door'),
    'ventlargo': ('Gevelrooster aluminium LARGO 356×115', 'VNT-LARGO', 'unit_pcs', 58.0, 'alu', 'frames', 'Facade ventilation grille'),
    'ventglas':  ('Raamrooster GLASMAX 150×80', 'VNT-GLASMAX', 'unit_pcs', 27.0, 'alu', 'frames', 'Window ventilation grille'),
    'ventduco':  ('Raamrooster DUCOLINE 88×95', 'VNT-DUCO', 'unit_pcs', 19.0, 'alu', 'frames', 'Window ventilation grille'),
    # steel, aluminium
    'jordahl':   ('Ankerrail JORDAHL JTA 38/17 met T-bout', 'JOR-JTA-3817', 'unit_pcs', 18.50, 'mst', 'steel', 'Cast-in anchor channel with bolt, facade fixing'),
    'railalu':   ('Aluminium balkonhekwerk, poedercoating (per element)', 'RAIL-ALU', 'unit_pcs', 340.0, 'mst', 'steel', 'Aluminium balustrade element'),
    'railsteel': ('Stalen balkonhekwerk thermisch verzinkt (per element)', 'RAIL-STAAL', 'unit_pcs', 410.0, 'mst', 'steel', 'Galvanised steel balustrade element'),
    'railglass': ('Glazen balustrade gelaagd 20 mm (per element)', 'RAIL-GLAS', 'unit_pcs', 780.0, 'mst', 'steel', 'Laminated glass balustrade'),
    'raildef':   ('Hekwerkdeel (isolatieschil)', 'RAIL-DIV', 'unit_pcs', 60.0, 'mst', 'steel', 'Other railing part'),
    'alusheet':  ('Aluminium plaat 2 mm gepoedercoat', 'ALU-PL-2', 'unit_m2', 135.0, 'alu', 'steel', 'Aluminium sheet 2 mm'),
    'steelplate':('Staalplaat 5 mm thermisch verzinkt', 'STL-PL-5', 'unit_m2', 98.0, 'mst', 'steel', 'Steel plate 5 mm galvanised'),
    'steelbeam': ('Stalen profiel 100×200 verzinkt (per m)', 'STL-HEA', 'unit_m', 54.0, 'mst', 'steel', 'Steel section'),
    'sill':      ('Aluminium lekdorpel 70×52 gepoedercoat', 'ALU-LEK-7052', 'unit_pcs', 38.0, 'alu', 'steel', 'Aluminium drip sill'),
    'coping':    ('Aluminium dakrand profiel 420×66', 'ALU-DAKRAND', 'unit_pcs', 118.0, 'alu', 'steel', 'Roof edge coping'),
    'gutterrail':('Balkonrand aluminium rekje 2,6 m', 'ALU-REKJE', 'unit_pcs', 146.0, 'alu', 'steel', 'Balcony edge profile'),
    'letters':   ('Gevelletters / huisnummers RVS 3D', 'GEV-LETTER', 'unit_pcs', 32.0, 'alu', 'steel', '3D lettering'),
    'floordrain':('Douchegoot / vloerput RVS', 'SAN-GOOT', 'unit_pcs', 95.0, 'scr', 'sanitary', 'Stainless floor drain'),
    # finishes
    'tile':      ('Vloertegel porselein 60×60 (incl. 8 % snijverlies)', 'TEG-60', 'unit_m2', 32.0, 'tvl', 'finish', 'Porcelain tile 60×60'),
    'tileglue':  ('Tegellijm flexibel C2 (5 kg/m2)', 'TEG-LIJM', 'unit_m2', 2.75, 'tvl', 'finish', 'Flexible tile adhesive'),
    'tilegrout': ('Voegmortel cementgebonden', 'TEG-VOEG', 'unit_m2', 1.60, 'tvl', 'finish', 'Grout'),
    'artstone':  ('Kunststeen raamdorpel / afdekker 20 mm', 'KST-DORP', 'unit_m2', 165.0, 'tvl', 'finish', 'Artificial stone sill'),
    'glasswall': ('Douchewand veiligheidsglas 10 mm', 'GLS-DOUCHE', 'unit_m2', 210.0, 'scr', 'finish', 'Shower screen 10 mm'),
    'loggiacl':  ('Loggia wandafwerking gevelplaat 18 mm', 'GVL-LOG-18', 'unit_m2', 78.0, 'alu', 'finish', 'Loggia wall cladding'),
    'deck':      ('Terrasvlonder hardhout (per m2)', 'TRS-HH', 'unit_m2', 118.0, 'hku', 'finish', 'Hardwood decking'),
    # timber
    'ply15':     ('Multiplex berken 15 mm', 'MPX-15', 'unit_m2', 18.50, 'hku', 'timber', 'Plywood 15 mm'),
    'plym3':     ('Multiplex constructief (per m3)', 'MPX-M3', 'unit_m3', 1150.0, 'hku', 'timber', 'Structural plywood per m3'),
    'timberm':   ('Naaldhout regel 38×70 C18 geschaafd (per m)', 'NH-38-70', 'unit_m', 2.60, 'hku', 'timber', 'Timber stud'),
    'timberm3':  ('Constructiehout naaldhout KVH C24 (per m3)', 'KVH-C24', 'unit_m3', 640.0, 'hku', 'timber', 'Structural timber per m3'),
    'hsb':       ('HSB wandelement 100 mm geïsoleerd (per m2)', 'HSB-100', 'unit_m2', 96.0, 'hku', 'timber', 'Timber frame wall'),
    # screed
    'screed':    ('Cement-zand dekvloermortel gepompt (per m3)', 'DEK-CZ-M3', 'unit_m3', 142.0, 'mcm', 'mortar', 'Pumpable screed mortar'),
    'edgefoil':  ('Randstrook en folie (per m2 vloer)', 'DEK-RAND', 'unit_m2', 1.35, 'mcm', 'mortar', 'Edge strip and foil'),
    # sanitary
    'toilet':    ('Wandcloset keramisch, hangend, met zitting', 'SAN-WC', 'unit_pcs', 215.0, 'scr', 'sanitary', 'Wall-hung toilet'),
    'cistern':   ('Inbouwreservoir Geberit Duofix UP320 met bedieningsplaat', 'SAN-UP320', 'unit_pcs', 180.0, 'scr', 'sanitary', 'In-wall cistern with frame'),
    'cisterncase':('Ombouw inbouwreservoir (plaat en tegelklaar)', 'SAN-OMB', 'unit_pcs', 38.0, 'scr', 'sanitary', 'Casing of the in-wall cistern'),
    'basin':     ('Wastafel keramisch 60 cm met sifon en kraan', 'SAN-WAST', 'unit_pcs', 120.0, 'scr', 'sanitary', 'Washbasin set'),
    'basin2':    ('Dubbele wastafel 120 cm met kranen', 'SAN-WAST2', 'unit_pcs', 260.0, 'scr', 'sanitary', 'Double basin'),
    'porcbasin': ('Porseleinen wasbak / fontein', 'SAN-PORS', 'unit_pcs', 140.0, 'scr', 'sanitary', 'Porcelain basin'),
    'polybeton': ('Douchebak polybeton 90×90', 'SAN-DBAK', 'unit_pcs', 340.0, 'scr', 'sanitary', 'Polymer concrete shower tray'),
    # electro
    'meterkast': ('Prefab meterkast KM met groepenverdeler 3-fase', 'ELK-KM-3F', 'unit_pcs', 1180.0, 'egz', 'electro', 'Prefab meter cupboard'),
    'luminaire': ('Inbouwarmatuur LED gang 65×78', 'ELK-LED-GANG', 'unit_pcs', 85.0, 'egz', 'electro', 'Recessed LED luminaire'),
    'mailbox':   ('Brievenbus RVS wandmodel', 'BRV-02', 'unit_pcs', 210.0, 'egz', 'electro', 'Mailbox'),
    # kitchens
    'kitchen':   ('Keukenopstelling 3,0 m met werkblad, spoelbak en kranen', 'KEU-30', 'unit_pcs', 5800.0, 'kar', 'kitchen', 'Apartment kitchen'),
    'washer':    ('Wasmachine 8 kg energieklasse A', 'APP-WM-8', 'unit_pcs', 620.0, 'kar', 'kitchen', 'Washing machine'),
    'dryer':     ('Warmtepompdroger 8 kg', 'APP-DR-8', 'unit_pcs', 560.0, 'kar', 'kitchen', 'Heat-pump dryer'),
    'fridge':    ('Inbouw koel-vriescombinatie', 'APP-KV', 'unit_pcs', 540.0, 'kar', 'kitchen', 'Built-in fridge-freezer'),
    'tallcab':   ('Hoge kast inbouwapparatuur 1D', 'KEU-HK-1D', 'unit_pcs', 1350.0, 'kar', 'kitchen', 'Tall cabinet'),
}

# ---- Expense products: key -> (title, itemNumber, unit, price, supplier, category, budget item, note) -------------
EXP = {
    'crane':    ('Torenkraan incl. kraanmachinist (per draaiuur)', 'EXP-KRAAN', 'unit_hour', 95.0, 'hkr', 'hire', 'utilitiesRentInsuranceBudgetItem', 'Tower crane hire + operator ~ 9.8k + 6.1k per month / 170 h'),
    'hoist':    ('Bouwlift / materiaallift gebruik (per uur)', 'EXP-LIFT', 'unit_hour', 38.0, 'hkr', 'hire', 'utilitiesRentInsuranceBudgetItem', 'Construction hoist use'),
    'facadeacc':('Geveltoegang hangsteiger / klimplatform (per m2 gevel)', 'EXP-GEVTOEG', 'unit_m2', 7.80, 'sth', 'hire', 'utilitiesRentInsuranceBudgetItem', 'Facade access platform'),
    'liftplat': ('Hoogwerker 20 m (per dag)', 'EXP-HW20', 'unit_day', 285.0, 'sth', 'hire', 'utilitiesRentInsuranceBudgetItem', 'Boom lift'),
    'screedpump':('Dekvloerpomp en menger (per m3)', 'EXP-DEKPOMP', 'unit_m3', 18.0, 'mcm', 'hire', 'utilitiesRentInsuranceBudgetItem', 'Screed pump'),
    'waste':    ('Afvoer bouwafval gemengd, container 10 m3 pro rata (per m3)', 'EXP-AFVAL', 'unit_m3', 62.0, 'afv', 'service', 'subcontractedServicesBudgetItem', 'Waste container prorated per m3'),
    'coredrill':('Kernboren en zaagwerk sparing (per stuk)', 'EXP-KERN', 'unit_pcs', 22.0, 'bvr', 'service', 'subcontractedServicesBudgetItem', 'Core drilling / sawing'),
    'survey':   ('Inmeten en uitzetten maatvoering (per uur)', 'EXP-METEN', 'unit_hour', 78.0, 'ckw', 'service', 'subcontractedServicesBudgetItem', 'Surveyor'),
    'smalltool':('Klein gereedschap, hulpmaterieel en verbruiksmaterialen (per manuur)', 'EXP-KLEIN', 'unit_hour', 1.90, 'tpv', 'site', 'expenseBudgetItem', 'Small tools and consumables per man-hour'),
    'site':     ('Bouwplaatsvoorzieningen: bouwstroom, water, keet, afzetting (per manuur)', 'EXP-BPV', 'unit_hour', 1.25, 'tpv', 'site', 'expenseBudgetItem', 'Site overhead per man-hour'),
}

# budget item for materials: structural / building materials vs finished goods
MAT_BUDGET = {
    'blocks': 'rawMaterialsBudgetItem', 'mortar': 'rawMaterialsBudgetItem', 'insul': 'rawMaterialsBudgetItem', 'board': 'rawMaterialsBudgetItem',
    'prefab': 'rawMaterialsBudgetItem', 'timber': 'rawMaterialsBudgetItem', 'roof': 'rawMaterialsBudgetItem', 'steel': 'rawMaterialsBudgetItem',
    'frames': 'materialBudgetItem', 'doors': 'materialBudgetItem', 'finish': 'materialBudgetItem', 'sanitary': 'materialBudgetItem',
    'electro': 'materialBudgetItem', 'kitchen': 'materialBudgetItem', 'misc': 'consumablesBudgetItem',
}

# ---- Names for the workers ----------------------------------------------------------------------------------
FIRST = ['Jan', 'Piet', 'Kees', 'Henk', 'Willem', 'Bram', 'Daan', 'Sven', 'Ruben', 'Thijs', 'Joost', 'Mark', 'Erik', 'Rick', 'Tom', 'Niels', 'Stefan', 'Jeroen',
         'Dennis', 'Patrick', 'Marcel', 'Wouter', 'Bas', 'Gerrit', 'Hans', 'Frank', 'Martijn', 'Sander', 'Tim', 'Lars', 'Kamil', 'Marek', 'Piotr', 'Tomasz', 'Pawel',
         'Andrzej', 'Krzysztof', 'Jakub', 'Mateusz', 'Rafal', 'Bogdan', 'Ionut', 'Marius', 'Adrian', 'Cosmin', 'Rui', 'Tiago', 'Nuno', 'Hugo', 'Diogo', 'Mehmet',
         'Emre', 'Yusuf', 'Hakan', 'Omar', 'Youssef', 'Karim', 'Said', 'Ahmed', 'Mustafa', 'Dimitri', 'Ivan', 'Gediminas', 'Arturas', 'Nikola', 'Marko', 'Luka',
         'Sanne', 'Lotte', 'Esther', 'Marloes', 'Femke']
LAST = ['de Vries', 'Jansen', 'van den Berg', 'Bakker', 'Visser', 'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters', 'Hendriks', 'van Leeuwen',
        'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Smits', 'de Graaf', 'van der Meer', 'van der Linden', 'Kok', 'Jacobs', 'de Haan', 'Vermeulen', 'van den Heuvel',
        'van der Veen', 'van den Broek', 'de Bruijn', 'de Bruin', 'van der Heijden', 'Schouten', 'van Beek', 'Willems', 'van Vliet', 'van de Ven', 'Hoekstra', 'Maas',
        'Verhoeven', 'Koster', 'Prins', 'Huisman', 'Peeters', 'Kuipers', 'van Dam', 'Nowak', 'Kowalski', 'Wisniewski', 'Wojcik', 'Kaminski', 'Lewandowski', 'Zielinski',
        'Szymanski', 'Wozniak', 'Dabrowski', 'Kozlowski', 'Popescu', 'Ionescu', 'Dumitru', 'Stan', 'Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Oliveira',
        'Yilmaz', 'Kaya', 'Demir', 'Celik', 'Sahin', 'El Amrani', 'Bouzid', 'Haddou', 'Benali', 'Aksoy', 'Petrov', 'Ivanov', 'Kazlauskas', 'Jovanovic', 'Horvat']


# insulation boards: one product per thickness (the price follows the thickness)
PIR_T = [50, 60, 70, 90, 100, 120, 145, 150, 160, 180]
WOOL_T = [100, 120, 145, 150, 160]
for _t in PIR_T:
    MAT['pir%d' % _t] = ('PIR isolatieplaat spouw %d mm (lambda 0,022)' % _t, 'PIR-SP-%d' % _t, 'unit_m2', round(0.235 * _t, 2), 'dit', 'insul', 'PIR cavity board %d mm' % _t)
for _t in WOOL_T:
    MAT['wool%d' % _t] = ('Steenwol spouwplaat %d mm' % _t, 'WOOL-SP-%d' % _t, 'unit_m2', round(0.123 * _t, 2), 'dit', 'insul', 'Mineral wool cavity slab %d mm' % _t)
