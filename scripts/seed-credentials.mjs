// One-off helper: writes 5 demo credentials into the only Portfolio row so we
// can eyeball the new CREDENTIALS section without running the LLM. Safe to
// re-run — it merges into the existing profileData JSON and flips isPublic
// on so the slug URL renders without auth.
//
//   DATABASE_URL=postgres://… node scripts/seed-credentials.mjs
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const CREDS = [
  {
    title: "Microsoft Certified: Azure AI Engineer Associate",
    issuer: "Microsoft",
    issuerKey: "microsoft",
    credentialId: "FA88A4F6EA27B4CD",
    url: "https://learn.microsoft.com/en-us/credentials/",
    skills: ["Azure AI", "Cognitive Services", "Python", "Prompt Engineering"],
  },
  {
    title: "Deep Learning Specialization",
    issuer: "DeepLearning.AI",
    issuerKey: "deeplearning-ai",
    credentialId: "FMXAPNYLXAR5",
    url: "https://coursera.org/verify/specialization/FMXAPNYLXAR5",
    skills: ["Neural Networks", "TensorFlow", "CNNs", "Sequence Models"],
  },
  {
    title: "Machine Learning Specialization",
    issuer: "Coursera",
    issuerKey: "coursera",
    credentialId: "U6KG3KBWL93K",
    url: "https://coursera.org/verify/U6KG3KBWL93K",
    skills: ["Supervised Learning", "Logistic Regression", "Scikit-learn"],
  },
  {
    title: "CS229: Machine Learning",
    issuer: "Stanford Online",
    issuerKey: "stanford",
    credentialId: "BFCIAOFMPCSZ",
    url: "https://online.stanford.edu/",
    skills: ["Probabilistic Models", "SVMs", "Reinforcement Learning"],
  },
  {
    title: "AWS Certified Solutions Architect — Associate",
    issuer: "Amazon Web Services",
    issuerKey: "aws",
    credentialId: "AWS-SAA-C03-991122",
    url: "https://aws.amazon.com/verification",
    skills: ["EC2", "VPC", "S3", "Lambda", "CloudFormation"],
  },
];

const p = await db.portfolio.findFirst();
if (!p) {
  console.error("No portfolio in DB.");
  process.exit(1);
}

const profileData = (p.profileData && typeof p.profileData === "object")
  ? structuredClone(p.profileData)
  : {};
profileData.credentials = CREDS;

await db.portfolio.update({
  where: { id: p.id },
  data: {
    profileData,
    isPublic: true,
  },
});

console.log(
  `Seeded ${CREDS.length} credentials into ${p.slug} (owner: ${p.githubUsername}).`,
);
console.log(`Made portfolio public.`);
await db.$disconnect();
