-- Set exact map coordinates for Crown Ev Center and Hadi Ev Center
UPDATE "Branch"
SET "latitude" = 29.995425472044637, "longitude" = 73.2428932264022
WHERE "name" ILIKE '%Crown Ev%Center%'
   OR ("name" ILIKE '%Crown Ev%' AND "location" ILIKE '%Bahawalnagar%');

UPDATE "Branch"
SET "latitude" = 29.806322679116477, "longitude" = 72.86908609999999
WHERE "name" ILIKE '%Hadi Ev%';
