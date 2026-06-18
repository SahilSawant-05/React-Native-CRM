import { useEffect, useState } from "react";
import api from "../api/axios";
import businessVerificationIcon from "../assets/Businessverification.png";
import circleIcon from "../assets/circle.png";
import facebookIcon from "../assets/facebook.png";
import heroImage from "../assets/girl_cropped.png";
import shieldIcon from "../assets/shield.png";
import whatsappLogo from "../assets/whatsapp.png";

export default function WhatsAppConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const checkConnection = async () => {
      try {
        const res = await api.get("/api/whatsapp/me", {
          signal: controller.signal,
        });
        const { systemTokenEnc, status, wabaId, phoneNumberId } = res.data;

        const hasToken = typeof systemTokenEnc === "string" && systemTokenEnc.trim() !== "";
        const isActive = typeof status === "string" && status.trim().toUpperCase() === "ACTIVE";
        const hasMetaConnection = Boolean(
          (typeof wabaId === "string" && wabaId.trim() !== "") ||
          (typeof phoneNumberId === "string" && phoneNumberId.trim() !== "")
        );

        setIsConnected(hasToken && isActive && hasMetaConnection);
      } catch (err) {
        if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
        // No active account yet → button enabled
        setIsConnected(false);
        setError("");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    checkConnection();

    return () => controller.abort(); // cleanup on unmount / StrictMode remount
  }, []);

  const connect = async () => {
    try {
      setError("");
      const res = await api.get("/api/meta/login-url");
      if (!res.data?.url) {
        setError("Could not start Meta onboarding right now.");
        return;
      }
      window.location.href = res.data.url;
    } catch (connectError) {
      setError(
        connectError.response?.data?.message ||
          connectError.response?.data?.error ||
          "Could not start Meta onboarding right now."
      );
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-10">

          <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row w-full lg:w-auto gap-4 sm:gap-6">
            <div className="flex-shrink-0">
              <img src={whatsappLogo} alt="whatsapp business" className="w-8 h-10 mx-auto sm:mx-0" />
            </div>

            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl font-semibold text-center sm:text-left">
                Connect WhatsApp Business
              </h1>
              <p className="mt-1 mb-6 text-xs text-gray-500 text-center sm:text-left">
                Connect your WhatsApp Business account and start engaging{" "}
                <br className="hidden sm:block" />
                with your customers
              </p>

              <div className="shadow-2xl rounded-2xl p-5 bg-white">
                <ul className="space-y-4">

                  <li className="flex items-start gap-4">
                    <img src={businessVerificationIcon} alt="" className="w-8 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Business Verification</p>
                      <p className="text-xs text-gray-500">
                        A registered Business is required to apply for WhatsApp Business API.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <img src={circleIcon} alt="" className="w-7 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Working Website</p>
                      <p className="text-xs text-gray-500">
                        A valid and working website is required for your business verification.
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-4">
                    <img src={shieldIcon} alt="" className="w-7 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Secure & Reliable</p>
                      <p className="text-xs text-gray-500">
                        We follow WhatsApp's highest standards to keep your data safe and secure.
                      </p>
                    </div>
                  </li>

                  <li className="flex justify-center pt-2">
                    <button
                      onClick={connect}
                      disabled={isConnected || loading}
                      className={`flex items-center rounded-xl p-2 px-5 text-white text-sm font-medium transition-colors
                        ${isConnected || loading
                          ? "bg-gray-400 cursor-not-allowed opacity-70"
                          : "bg-blue-600 hover:bg-blue-700 cursor-pointer"
                        }`}
                    >
                      <img src={facebookIcon} className="w-7 rounded-2xl mr-2" alt="" />
                      {loading
                        ? "Checking..."
                        : isConnected
                        ? "Already Connected"
                        : "Connect with Facebook"}
                    </button>
                  </li>

                  {error && (
                    <li className="text-xs text-center text-rose-500 leading-relaxed">
                      {error}
                    </li>
                  )}

                  <li className="text-xs text-center text-gray-400 leading-relaxed">
                    {isConnected
                      ? "Your WhatsApp Business account is already connected."
                      : <>
                          You will be redirected to Facebook to securely authorize and{" "}
                          <br className="hidden sm:block" />
                          connect to your business account.
                        </>
                      }
                  </li>

                </ul>
              </div>
            </div>
          </div>

          <div className="hidden lg:flex flex-shrink-0 justify-center">
            <img src={heroImage} alt="" className="w-72 xl:w-96 2xl:w-[30rem] object-contain" />
          </div>

        </div>
      </div>
    </main>
  );
}



























// import { useState, useEffect } from "react";
// import api from "../api/axios";

// export default function WhatsAppConnect() {
//   const [isConnected, setIsConnected] = useState(false);

//   useEffect(() => {
//     const token = localStorage.getItem("whatsapp_access_token");
//     if (token) setIsConnected(true);
//   }, []);

//   const connect = async () => {
//     const res = await api.get("/api/meta/login-url");
//     window.location.href = res.data.url;
//   };

//   return (
//     <main className="min-h-screen bg-gray-50">
//       <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
//         <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-10">
//           <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row w-full lg:w-auto gap-4 sm:gap-6">
//             <div className="flex-shrink-0">
//               <img src="/src/assets/whatsapp.png" alt="whatsapp business" className="w-8 h-10 mx-auto sm:mx-0" />
//             </div>

//             <div className="flex-1">
//               <h1 className="text-xl sm:text-2xl font-semibold text-center sm:text-left">
//                 Connect WhatsApp Business
//               </h1>
//               <p className="mt-1 mb-6 text-xs text-gray-500 text-center sm:text-left">
//                 Connect your WhatsApp Business account and start engaging{" "}
//                 <br className="hidden sm:block" />
//                 with your customers
//               </p>

//               <div className="shadow-2xl rounded-2xl p-5 bg-white">
//                 <ul className="space-y-4">
//                   <li className="flex items-start gap-4">
//                     <img src="/src/assets/Businessverification.png" alt="" className="w-8 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-sm">Business Verification</p>
//                       <p className="text-xs text-gray-500">A registered Business is required to apply for WhatsApp Business API.</p>
//                     </div>
//                   </li>

//                   <li className="flex items-start gap-4">
//                     <img src="/src/assets/circle.png" alt="" className="w-7 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-sm">Working Website</p>
//                       <p className="text-xs text-gray-500">A valid and working website is required for your business verification.</p>
//                     </div>
//                   </li>

//                   <li className="flex items-start gap-4">
//                     <img src="/src/assets/shield.png" alt="" className="w-7 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-sm">Secure & Reliable</p>
//                       <p className="text-xs text-gray-500">We follow WhatsApp's highest standards to keep your data safe and secure.</p>
//                     </div>
//                   </li>

//                   {/* Button */}
//                   <li className="flex justify-center pt-2">
//                     {isConnected ? (
//                       <button
//                         disabled
//                         className="flex items-center gap-2 rounded-xl bg-green-500 p-2 px-5 text-white text-sm font-medium cursor-not-allowed"
//                       >
//                         <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                           <polyline points="20 6 9 17 4 12" />
//                         </svg>
//                         Connected
//                       </button>
//                     ) : (
//                       <button
//                         onClick={connect}
//                         className="flex items-center cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors p-2 px-5 text-white text-sm font-medium"
//                       >
//                         <img src="/src/assets/facebook.png" className="w-7 rounded-2xl mr-2" alt="" />
//                         Connect with Facebook
//                       </button>
//                     )}
//                   </li>

//                   <li className="text-xs text-center leading-relaxed">
//                     {isConnected ? (
//                       <span className="text-green-500 font-medium">Your WhatsApp Business account is connected.</span>
//                     ) : (
//                       <span className="text-gray-400">
//                         You will be redirected to Facebook to securely authorize and{" "}
//                         <br className="hidden sm:block" />
//                         connect to your business account.
//                       </span>
//                     )}
//                   </li>
//                 </ul>
//               </div>
//             </div>
//           </div>

//           <div className="hidden lg:flex flex-shrink-0 justify-center">
//             <img src="/src/assets/girl_cropped.png" alt="" className="w-72 xl:w-96 2xl:w-[30rem] object-contain" />
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// }



// import { useState, useEffect } from "react";
// import api from "../api/axios";

// export default function WhatsAppConnect() {
//   const [isConnected, setIsConnected] = useState(false);

//   useEffect(() => {
//     const token = sessionStorage.getItem("whatsapp_access_token");
//     if (token) setIsConnected(true);
//   }, []);

//   const connect = async () => {
//     const res = await api.get("/api/meta/login-url");
//     window.location.href = res.data.url;
//   };

//   return (
//     <main className="min-h-screen bg-gray-50">
//       <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
//         <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-10">
//           <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row w-full lg:w-auto gap-4 sm:gap-6">
//             <div className="flex-shrink-0">
//               <img src="/src/assets/whatsapp.png" alt="whatsapp business" className="w-8 h-10 mx-auto sm:mx-0" />
//             </div>

//             <div className="flex-1">
//               <h1 className="text-xl sm:text-2xl font-semibold text-center sm:text-left">
//                 Connect WhatsApp Business
//               </h1>
//               <p className="mt-1 mb-6 text-xs text-gray-500 text-center sm:text-left">
//                 Connect your WhatsApp Business account and start engaging{" "}
//                 <br className="hidden sm:block" />
//                 with your customers
//               </p>

//               <div className="shadow-2xl rounded-2xl p-5 bg-white">
//                 <ul className="space-y-4">
//                   <li className="flex items-start gap-4">
//                     <img src="/src/assets/Businessverification.png" alt="" className="w-8 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-sm">Business Verification</p>
//                       <p className="text-xs text-gray-500">A registered Business is required to apply for WhatsApp Business API.</p>
//                     </div>
//                   </li>

//                   <li className="flex items-start gap-4">
//                     <img src="/src/assets/circle.png" alt="" className="w-7 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-sm">Working Website</p>
//                       <p className="text-xs text-gray-500">A valid and working website is required for your business verification.</p>
//                     </div>
//                   </li>

//                   <li className="flex items-start gap-4">
//                     <img src="/src/assets/shield.png" alt="" className="w-7 flex-shrink-0" />
//                     <div>
//                       <p className="font-medium text-sm">Secure & Reliable</p>
//                       <p className="text-xs text-gray-500">We follow WhatsApp's highest standards to keep your data safe and secure.</p>
//                     </div>
//                   </li>

//                   {/* Button */}
//                   <li className="flex justify-center pt-2">
//                     {isConnected ? (
//                       <button
//                         disabled
//                         className="flex items-center gap-2 rounded-xl bg-green-500 p-2 px-5 text-white text-sm font-medium cursor-not-allowed"
//                       >
//                         <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
//                           <polyline points="20 6 9 17 4 12" />
//                         </svg>
//                         Connected
//                       </button>
//                     ) : (
//                       <button
//                         onClick={connect}
//                         className="flex items-center cursor-pointer rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors p-2 px-5 text-white text-sm font-medium"
//                       >
//                         <img src="/src/assets/facebook.png" className="w-7 rounded-2xl mr-2" alt="" />
//                         Connect with Facebook
//                       </button>
//                     )}
//                   </li>

//                   <li className="text-xs text-center leading-relaxed">
//                     {isConnected ? (
//                       <span className="text-green-500 font-medium">Your WhatsApp Business account is connected.</span>
//                     ) : (
//                       <span className="text-gray-400">
//                         You will be redirected to Facebook to securely authorize and{" "}
//                         <br className="hidden sm:block" />
//                         connect to your business account.
//                       </span>
//                     )}
//                   </li>
//                 </ul>
//               </div>
//             </div>
//           </div>

//           <div className="hidden lg:flex flex-shrink-0 justify-center">
//             <img src="/src/assets/girl_cropped.png" alt="" className="w-72 xl:w-96 2xl:w-[30rem] object-contain" />
//           </div>
//         </div>
//       </div>
//     </main>
//   );
// }
