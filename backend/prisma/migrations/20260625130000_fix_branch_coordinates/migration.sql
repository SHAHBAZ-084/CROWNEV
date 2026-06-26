-- Correct Bahawalnagar longitude (73.x not 72.x) and set Hadi Ev Center coordinates
UPDATE "Branch"
SET "latitude" = 29.995378379735364, "longitude" = 73.24281476617726
WHERE "name" ILIKE '%Bahawalnagar%';

UPDATE "Branch"
SET "latitude" = 29.806159737354488, "longitude" = 72.86909682454248
WHERE "name" ILIKE '%Hadi Ev%';
