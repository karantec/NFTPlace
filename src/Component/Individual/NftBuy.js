import React, { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import NFTCollection from "./NFtCard";

import TabSwitchers from "./TabSwitcher";
import { Link, useLocation, useParams } from "react-router-dom";
import { getNftBId } from "../../services/api";
import axios from "axios";
import { toast } from "react-hot-toast";
import { ethers } from "ethers";
import {
  NftMarketPlace,
  NftMarketPlace_Abi,
  nwfntToken,
  nwfntToken_Abi,
} from "../../services/config";
const NFTDetailsPage = () => {
  const [isLoading, setIsLoading] = useState(false);

  const [nft, setNft] = useState({});
  const location = useLocation();

  // Extract the query string portion from the URL (remove '/buy/')
  const queryString = location.pathname.split("/buy/")[1];

  // Split the query string by '&' and then by '=' to get key-value pairs
  const params = {};
  queryString.split("&").forEach((param) => {
    const [key, value] = param.split("=");
    params[key] = value;
  });

  // Now you can access `id` and `contract`
  const id = params.id;
  const contract = params.contract;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const fetchNft = async () => {
      try {
        const response = await axios.get(
          `https://nywnftbackend-1.onrender.com/api/nft/get/tokenId?tokenId=${id}&contractAddress=${contract}`
        );

        setNft(response.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchNft();
  }, [id]); // Thi
  const handleCreateCollection = async () => {
    // Validation

    if (!window.ethereum) {
      toast.error("MetaMask is not installed!");
      return;
    }

    try {
      setIsLoading(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();

      const useAddress = await signer.getAddress();
      console.log("User Address:", useAddress, nft?.data?.walletAddress);
      if (useAddress.toLowerCase() === nft?.data?.walletAddress.toLowerCase()) {
        toast.error("You can't buy your own NFT!");

        return;
      }
      const contractABI = NftMarketPlace_Abi;
      const TokenABI = nwfntToken_Abi;
      const contract = new ethers.Contract(NftMarketPlace, contractABI, signer);
      const nwfntTokenContract = new ethers.Contract(
        nwfntToken,
        TokenABI,
        signer
      );

      // Get allowance
      const allowance = await nwfntTokenContract.allowance(
        useAddress,
        NftMarketPlace
      );
      console.log("Current allowance:", allowance.toString());
      const allowanceval = 10000000000;
      // Convert allowance to a number and compare it to the required allowance
      const allowanceValue = ethers.utils.parseUnits(
        allowanceval.toString(),
        3
      ); // Ensure it's in the right decimal format
      if (allowance.gte(allowanceValue)) {
        // If allowance is sufficient, proceed to purchase
        const tx = await contract.buyListedNFT(
          nft?.data?.contractAddress,
          nft?.data?.tokenId,
          nft?.data?.walletAddress,
          nft?.data?.quantity
        );

        console.log("Transaction sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt);

        const NFTListedEvent = receipt.events.find(
          (event) => event.event === "NFTSold"
        );

        if (NFTListedEvent) {
          const newId = NFTListedEvent.args.tokenId.toString();
          console.log("New Token ID:", newId);
          //toast.success("NFT Listed successfully!");
          await handleApiCall(newId, nft?.data?.contractAddress, tx.hash);
        } else {
          console.error("NFTSold event not found in receipt.");
          toast.error("NFT created, but failed to retrieve token ID.");
        }
      } else {
        // If allowance is not sufficient, set approval
        const approvalTx = await nwfntTokenContract.approve(
          NftMarketPlace,
          allowanceValue
        );
        const approvalReceipt = await approvalTx.wait();
        toast.success("Approval successful!");

        const tx = await contract.buyListedNFT(
          nft?.data?.contractAddress,
          nft?.data?.tokenId,
          nft?.data?.walletAddress,
          nft?.data?.quantity
        );
        console.log("Transaction sent:", tx.hash);
        const listReceipt = await tx.wait();
        console.log("Transaction confirmed:", listReceipt);

        const NFTListedEvent = listReceipt.events.find(
          (event) => event.event === "NFTSold"
        );

        if (NFTListedEvent) {
          const newId = NFTListedEvent.args.tokenId.toString();
          console.log("New Token ID:", newId);
         // toast.success("NFT Listed successfully!");
          await handleApiCall(newId, nft?.data?.contractAddress, tx.hash);
        } else {
          console.error("NFTListed event not found in receipt.");
          toast.error("NFT created, but failed to retrieve token ID.");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiCall = async (tokenId, contractAddress, hash) => {
    // Fetch token from localStorage
    const token = localStorage.getItem("walletToken");

    // Prepare data for the API call
    const fdata = {
      tokenId: tokenId,
      isMinted: true,
      transactionHash: hash,
      contractAddress: contractAddress,
      price: nft?.data?.price,
      quantity: nft?.data?.quantity,
    };

    try {
      // Make API call
      const response = await fetch("https://nywnftbackend-1.onrender.com/api/nft/buy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json", // Ensure content type is set to JSON
        },
        body: JSON.stringify(fdata), // Convert fdata to JSON string
      });

      if (!response.ok) {
        // If the response is not OK, throw an error with the response text
        const errorText = await response.text();
        console.error(`Failed to create collection: ${errorText}`);
        throw new Error("Failed to create the collection contract.");
      }

      // Parse and handle successful response
      const data = await response.json();
      console.log("NFT buy successfully:", data);
      toast.success("NFT buy successfully!");
    } catch (error) {
      // Handle any errors that occur during the request
      console.error("Error creating contract:", error);
      toast.error("An error occurred while creating the contract.");
    }
  };
  return (
    <>
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column - Media Player */}
          <div className="relative">
            {/* Timer Overlay */}
            {/* <div className="absolute top-4 left-0 right-0 z-10 flex justify-center">
            <div className="bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-sm">
              02 : 12 : 56
            </div>
          </div> */}

            {/* Main Image */}
            <div className="rounded-xl overflow-hidden">
              <img
                src={nft?.data?.imageUrl}
                alt="Concert scene"
                className="w-full object-cover aspect-square"
              />
            </div>
          </div>

          {/* Right Column - Details */}
          <div className="space-y-6">
            {/* Verified Badge and Title */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-blue-500">{nft?.data?.tokenId}</span>
                {/* <img
                  src="/api/placeholder/20/20"
                  alt="Verified"
                  className="w-5 h-5"
                /> */}
              </div>
              <h1 className="text-2xl font-bold">{nft?.data?.name}</h1>
            </div>

            {/* Creator Info */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="text-sm">Created by</div>
                <img
                  src={nft?.creatorProfileIMG}
                  alt="Creator"
                  className="w-8 h-8 rounded-full"
                />
                <span className="font-medium">{nft?.creatorname}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-sm">Owned by</div>
                <img
                  src={nft?.ownerWalletProfile}
                  alt="Owner"
                  className="w-8 h-8 rounded-full"
                />
                <span className="font-medium">{nft?.ownerName}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <span>Quantity</span>
                <span>{nft?.data?.quantity}</span>
              </div>
              <div className="flex items-center gap-1">
                <span>Category</span>
                <span>{nft?.data?.categoryName}</span>
              </div>
              {/* <div className="flex items-center gap-1">
              <span>❤️</span>
              <span>2 Wishlist</span>
            </div> */}
              {/* <button className="flex items-center gap-1">
                <Share2 size={16} />
                <span>Share</span>
              </button> */}
            </div>

            {/* Current Price */}
            <div className="space-y-2">
              <div className="text-sm text-gray-600"> Price</div>
              <div className="text-xl font-bold">{nft?.data?.price} NYFT</div>
              {/* <div className="text-sm text-gray-600">≈ $740</div> */}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              {/* <button
                className="w-64 bg-blue-600 text-white py-3 rounded-xl font-medium"
                onClick={handleCreateCollection}
              >
                Buy now
              </button> */}
              <button
                className={`mt-4 w-64 bg-blue-600 py-2 rounded-md ${
                  isLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-black text-white"
                }`}
                onClick={handleCreateCollection}
                disabled={isLoading} // Disable the button while loading
              >
                {isLoading ? (
                  <div className="flex justify-center items-center space-x-2">
                    <div className="w-5 h-5 border-4 border-t-4 border-white border-solid rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </div>
                ) : (
                  "  Buy now"
                )}
              </button>

              {/* <button className="flex-1 border border-gray-300 py-3 rounded-xl font-medium">
              Make offer
            </button>
            <button className="border border-gray-300 p-3 rounded-xl">
              🛒
            </button> */}
            </div>
          </div>
        </div>
      </div>

      <TabSwitchers description={nft?.data?.description} />
      <NFTCollection />
    </>
  );
};

export default NFTDetailsPage;
