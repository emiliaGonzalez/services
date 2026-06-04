-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'PAX', 'UNIT', 'FIXED_RANGE', 'PAX_RANGE', 'UNIT_RANGE');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "names" JSONB NOT NULL,
    "icon" TEXT,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pricingId" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_locations" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "service_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_photos" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricings" (
    "id" TEXT NOT NULL,
    "type" "PriceType" NOT NULL,

    CONSTRAINT "pricings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_ranges" (
    "id" TEXT NOT NULL,
    "pricingId" TEXT NOT NULL,
    "low" INTEGER NOT NULL DEFAULT 0,
    "high" INTEGER,
    "price" DECIMAL(12,2) NOT NULL,
    "dependsOnOptionId" TEXT,

    CONSTRAINT "price_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_groups" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingMode" TEXT NOT NULL,
    "dependsOnGroupId" TEXT,

    CONSTRAINT "option_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pricingId" TEXT,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "services_pricingId_key" ON "services"("pricingId");

-- CreateIndex
CREATE INDEX "services_ownerId_idx" ON "services"("ownerId");

-- CreateIndex
CREATE INDEX "service_locations_serviceId_idx" ON "service_locations"("serviceId");

-- CreateIndex
CREATE INDEX "service_photos_serviceId_idx" ON "service_photos"("serviceId");

-- CreateIndex
CREATE INDEX "price_ranges_pricingId_idx" ON "price_ranges"("pricingId");

-- CreateIndex
CREATE INDEX "option_groups_serviceId_idx" ON "option_groups"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "options_pricingId_key" ON "options"("pricingId");

-- CreateIndex
CREATE INDEX "options_groupId_idx" ON "options"("groupId");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "pricings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_ranges" ADD CONSTRAINT "price_ranges_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "pricings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_ranges" ADD CONSTRAINT "price_ranges_dependsOnOptionId_fkey" FOREIGN KEY ("dependsOnOptionId") REFERENCES "options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_dependsOnGroupId_fkey" FOREIGN KEY ("dependsOnGroupId") REFERENCES "option_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "pricings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

