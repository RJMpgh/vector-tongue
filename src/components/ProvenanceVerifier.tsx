import React, { useState, useEffect } from "react";
import { FileCheck, AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, XCircle, ShieldAlert, Hash } from "lucide-react";
import { ManifestReport } from "../types";

const FALLBACK_MANIFEST: ManifestReport = {
  manifest_version: "1.0",
  project: "Vector Tongue",
  recorded_by: "RJ Marler",
  polygon_status: "pending_identifiers",
  warnings: [
    "No external transaction hash recorded on Polygon.",
    "External files referenced in manifest not present in web distribution."
  ],
  all_local_hashes_match: false,
  cautions: [
    "Hashes were supplied by RJ and have not been recomputed because the referenced files were unavailable.",
    "A package containing a USPTO cover sheet is not by itself proof that an application was filed or accepted.",
    "The October title on record is not identical to the narrower output-only cross-model translation framework implemented in this repository.",
    "No legal conclusion about authorship, inventorship, prior art, patent priority, ownership, or enforceability is made."
  ],
  hashchain_record: {
    timestamp_utc: "2025-10-18T14:12:43.533183Z",
    inventor_name_on_record: "Regan Marler",
    contact_email: "rjmarler8@gmail.com",
    title_on_record: "VECTOR TONGUE: A System for Multi-Modal, Privacy-Preserving, Low-Latency Voice AI with Federated Telemetry"
  },
  artifacts: [
    {
      path: "VectorTongue_ReganMarler_2025.pdf",
      byte_size: 10583,
      expected_sha256: "f04952476c2ba4e98a3ecee07d8d98591a20eca2dd58e02a6e183b9f8c2f45de",
      actual_sha256: null,
      status: "missing",
      role: "provisional_package_file"
    },
    {
      path: "USPTO_SB16_cover.pdf",
      byte_size: 2522,
      expected_sha256: "eefc9bc3a26ba58f6c622d3d045d3e6dd7a0193ba95fee27455006c959562a55",
      actual_sha256: null,
      status: "missing",
      role: "provisional_package_file"
    },
    {
      path: "drawings_placeholder.pdf",
      byte_size: 2642,
      expected_sha256: "51ad58afdd4fbab08594f2be02e1cbbcb651b2742c0ae7fb3a92dc7718038474",
      actual_sha256: null,
      status: "missing",
      role: "provisional_package_file"
    },
    {
      path: "README_BEFORE_UPLOAD.txt",
      byte_size: 1389,
      expected_sha256: "859f2c0d3dc75d8d57047b02df17d33c169f45d9d4bc09bd83467282e159ce83",
      actual_sha256: null,
      status: "missing",
      role: "provisional_package_file"
    },
    {
      path: "vector_tongue_priority_final.pdf",
      expected_sha256: "d302430828b52e3ccde59e2c8df802d5c25a993cec4a5ca290edc6e971e7df90",
      actual_sha256: null,
      status: "missing",
      role: "priority_declaration"
    },
    {
      path: "VectorTongue_Provisional_ReganMarler.zip",
      expected_sha256: "89ee79424350baf61d0f3af95211535bbe414daefd548bbee709e7f32d43488c",
      actual_sha256: null,
      status: "missing",
      role: "provisional_bundle"
    },
    {
      path: "vector-tongue-best-ever.zip",
      expected_sha256: "c304402af1023dd28bd681d30e3b76b416ba7c0add6ea5487a52c739ee6cec52",
      actual_sha256: null,
      status: "missing",
      role: "core_streamlit_engine"
    },
    {
      path: "vector_tongue_simulation_20250804_230140.json",
      expected_sha256: "33a6dfb7711accae197c625cccef63740e71d7f39f2fbc06342021de4bdd1cb3",
      actual_sha256: null,
      status: "missing",
      role: "simulation_benchmark"
    }
  ]
};

export const ProvenanceVerifier: React.FC = () => {
  const [report, setReport] = useState<ManifestReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchManifest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/manifest");
      if (!res.ok) {
        throw new Error("Failed to load manifest");
      }
      const data = await res.json();
      setReport(data);
    } catch {
      // Graceful fallback for iOS/offline
      setReport(FALLBACK_MANIFEST);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManifest();
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-indigo-500/20 text-indigo-400">
                <FileCheck className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-semibold text-white">Priority & Provenance Manifest Verifier</h2>
            </div>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl">
              Inspects cryptographic hashes and metadata from <span className="text-slate-200 font-mono">vector_tongue_priority_manifest.json</span>. Reports missing, invalid, or matched local files without asserting legal conclusions.
            </p>
          </div>

          <button
            onClick={fetchManifest}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 text-slate-300 hover:text-white text-xs font-medium rounded-lg border border-slate-700/60 transition-all cursor-pointer whitespace-nowrap touch-manipulation min-h-[42px] active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Re-verify Manifest</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm rounded-xl">
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Inventor / Recorded By</span>
              <div className="text-base font-bold text-white mt-1">
                {report.recorded_by || "RJ Marler"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Manifest Version: <span className="font-mono text-slate-300">{report.manifest_version}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Hashchain Timestamp</span>
              <div className="text-xs font-mono text-indigo-300 mt-2 break-all">
                {report.hashchain_record?.timestamp_utc || "2025-10-18T14:12:43.533183Z"}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Contact: <span className="text-slate-300">{report.hashchain_record?.contact_email || "rjmarler8@gmail.com"}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl">
              <span className="text-xs font-medium text-slate-400">Polygon Network Status</span>
              <div className="text-sm font-semibold text-amber-400 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>{report.polygon_status.replace(/_/g, " ")}</span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Reported Marketplace: <span className="text-slate-300">OpenSea</span>
              </div>
            </div>
          </div>

          {/* Artifact Hash Verification Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-400" />
                Registered Artifacts & SHA-256 Hashes
              </h3>
              <span className="text-xs text-slate-400">{report.artifacts.length} registered files</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider border-b border-slate-800 font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Artifact Path</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4">Expected SHA-256</th>
                    <th className="py-2.5 px-4">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {report.artifacts.map((art, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-4 text-slate-200 font-medium font-sans">
                        {art.path}
                        {art.byte_size && (
                          <span className="text-[10px] text-slate-500 ml-2">({art.byte_size} bytes)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 font-sans">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-300">
                          {art.role || "artifact"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px] max-w-xs truncate" title={art.expected_sha256}>
                        {art.expected_sha256.substring(0, 16)}...{art.expected_sha256.substring(56)}
                      </td>
                      <td className="py-2.5 px-4">
                        {art.status === "match" && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-medium font-sans">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Matched
                          </span>
                        )}
                        {art.status === "missing" && (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-medium font-sans">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            File Missing Locally
                          </span>
                        )}
                        {art.status === "mismatch" && (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-medium font-sans">
                            <XCircle className="w-3.5 h-3.5" />
                            Hash Mismatch
                          </span>
                        )}
                        {art.status === "invalid_hash" && (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-medium font-sans">
                            <XCircle className="w-3.5 h-3.5" />
                            Malformed Hash
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cautions and Disclaimers */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Essential Methodological & Legal Cautions
            </h3>
            <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside leading-relaxed">
              {report.cautions?.map((caution, idx) => (
                <li key={idx} className="text-slate-300">
                  {caution}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
