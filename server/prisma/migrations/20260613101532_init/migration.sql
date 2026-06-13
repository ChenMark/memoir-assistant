-- CreateTable
CREATE TABLE "friends" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL,
    "relationship" TEXT,
    "generation" INTEGER,
    "parentId" TEXT,
    "spouseId" TEXT,
    "school" TEXT,
    "classInfo" TEXT,
    "graduationYear" TEXT,
    "metAt" TEXT,
    "metYear" TEXT,
    "tags" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "friends_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "friends_userId_idx" ON "friends"("userId");
