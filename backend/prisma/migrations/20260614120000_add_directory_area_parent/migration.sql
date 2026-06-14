ALTER TABLE "directory_areas"
  ADD COLUMN "parent_area_id" INTEGER;

CREATE INDEX "IDX_directory_areas_parent_area_id"
  ON "directory_areas"("parent_area_id");

ALTER TABLE "directory_areas"
  ADD CONSTRAINT "FK_directory_areas_parent_area"
  FOREIGN KEY ("parent_area_id") REFERENCES "directory_areas"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

UPDATE "directory_areas" AS child
SET "parent_area_id" = parent."id"
FROM "directory_areas" AS parent
WHERE parent."slug" = '6th-of-october'
  AND child."slug" IN (
    'october-1st-district',
    'october-2nd-district',
    'october-3rd-district',
    'october-4th-district',
    'october-5th-district',
    'october-6th-district',
    'october-7th-district',
    'october-8th-district',
    'october-9th-district',
    'october-10th-district',
    'october-11th-district',
    'october-12th-district',
    'october-al-motamayez',
    'october-gharb-somid',
    'hadayek-october',
    'october-northern-expansions'
  );

UPDATE "directory_areas" AS child
SET "parent_area_id" = parent."id"
FROM "directory_areas" AS parent
WHERE parent."slug" = 'sheikh-zayed'
  AND child."slug" IN ('al-khamayel');
