/**
 * tag-resume-clean.mjs
 *
 * Emergency utility — directly tags one or all resumes as `clean`
 * in your real S3 bucket WITHOUT running any scanner.
 *
 * Use this when:
 *   - You already trust the file (you uploaded it yourself in testing)
 *   - You just want to unblock viewing in the app immediately
 *   - You want to reset a resume that got stuck on `pending`
 *
 * Usage:
 *   # Tag a single resume:
 *   node tag-resume-clean.mjs <bucket> <s3-key>
 *
 *   # Tag ALL pending resumes in bucket (bulk unblock after testing):
 *   node tag-resume-clean.mjs <bucket> --all-pending
 *
 *   # Tag everything including infected (nuclear option):
 *   node tag-resume-clean.mjs <bucket> --all
 */

import {
  S3Client,
  GetObjectTaggingCommand,
  PutObjectTaggingCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const SCAN_TAG_KEY = "scan-status";
const CLEAN        = "clean";
const PENDING      = "pending";

const [,, bucket, keyOrFlag] = process.argv;
if (!bucket || !keyOrFlag) {
  console.error("Usage: node tag-resume-clean.mjs <bucket> <key|--all-pending|--all>");
  process.exit(1);
}

const region = process.env.AWS_REGION ?? "us-east-1";
const s3 = new S3Client({ region });

async function tagClean(bucket, key) {
  await s3.send(new PutObjectTaggingCommand({
    Bucket: bucket,
    Key: key,
    Tagging: {
      TagSet: [{ Key: SCAN_TAG_KEY, Value: CLEAN }],
    },
  }));
  console.log(`  ✅  ${key}  →  scan-status=clean`);
}

async function listKeys(bucket, onlyPending = false) {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "resumes/",
      ContinuationToken: token,
    }));
    for (const obj of res.Contents ?? []) {
      if (onlyPending) {
        const tagRes = await s3.send(new GetObjectTaggingCommand({
          Bucket: bucket, Key: obj.Key,
        }));
        const tag = tagRes.TagSet?.find(t => t.Key === SCAN_TAG_KEY)?.Value;
        if (tag === PENDING) keys.push(obj.Key);
      } else {
        keys.push(obj.Key);
      }
    }
    token = res.NextContinuationToken;
  } while (token);
  return keys;
}

async function main() {
  if (keyOrFlag === "--all-pending" || keyOrFlag === "--all") {
    const onlyPending = keyOrFlag === "--all-pending";
    console.log(`🔍 Finding ${onlyPending ? "pending" : "all"} resumes in s3://${bucket}/resumes/ ...`);
    const keys = await listKeys(bucket, onlyPending);
    if (keys.length === 0) {
      console.log("Nothing to update.");
      return;
    }
    console.log(`   Tagging ${keys.length} file(s) as clean:\n`);
    for (const key of keys) await tagClean(bucket, key);
    console.log(`\n✅ Done. All resumes are now viewable in the app.`);
  } else {
    await tagClean(bucket, keyOrFlag);
    console.log("\n✅ Resume is now viewable in the app.");
  }
}

main().catch(err => { console.error(err); process.exit(1); });