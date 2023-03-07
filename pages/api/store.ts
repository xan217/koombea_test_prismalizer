const fs = require('fs');

let dbmodel = require('assets/output/output.prisma');
import { NextApiRequest, NextApiResponse } from "next";

function saveFile(formattedText: string) {
  
}

export default async function (req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const schema = req.body.schema as string;
  await fs.writeFileSync('assets/output/output.prisma', schema);
}
