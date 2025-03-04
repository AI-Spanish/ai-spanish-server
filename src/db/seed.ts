import db from "@/db";
import * as schema from "./schema";

import wordBooks from "../../public/wordBooks.json";
await db.insert(schema.wordBook).values(wordBooks).onConflictDoNothing();

import DELE_A1 from "../../public/DELE_A1/DELE_A1.json";
import DELE_A1_inBook from "../../public/DELE_A1/DELE_A1_inBook.json";
await db.insert(schema.word).values(DELE_A1);
await db.insert(schema.wordInBook).values(DELE_A1_inBook);

import modernSpanish from "../../public/modernSpanish/modernSpanish.json";
import modernSpanish_inBook from "../../public/modernSpanish/modernSpanish_inBook.json";
await db.insert(schema.word).values(modernSpanish);
await db.insert(schema.wordInBook).values(modernSpanish_inBook);

import NewMiddleSchool from "../../public/NewMiddleSchool/NewMiddleSchool.json";
import NewMiddleSchool_inBook from "../../public/NewMiddleSchool/NewMiddleSchool_inBook.json";
await db.insert(schema.word).values(NewMiddleSchool);
await db.insert(schema.wordInBook).values(NewMiddleSchool_inBook);

import middleSchoolStandard from "../../public/middleSchoolStandard/middleSchoolStandard.json";
import middleSchoolStandard_inBook from "../../public/middleSchoolStandard/middleSchoolStandard_inBook.json";
await db.insert(schema.word).values(middleSchoolStandard);
await db.insert(schema.wordInBook).values(middleSchoolStandard_inBook);

console.log("Seeding complete.");
