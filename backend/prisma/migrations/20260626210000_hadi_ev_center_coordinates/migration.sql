-- Correct Hadi Ev Center map coordinates
UPDATE "Branch"
SET "latitude" = 29.80616441707204, "longitude" = 72.86909682883606
WHERE "name" ILIKE '%Hadi Ev%'
   OR "location" ILIKE '%Chishtian%';
