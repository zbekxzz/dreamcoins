import axios from 'axios';
import { useState } from 'react';
import { ethers } from "ethers";
import { Row, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Create = ({ marketplace, nft }) => {
  const [fileImg, setFile] = useState(null);
  const [name, setName] = useState("");
  const [desc, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const sendJSONtoIPFS = async (ImgHash) => {
    try {
      const resJSON = await axios({
        method: "post",
        url: "https://api.pinata.cloud/pinning/pinJsonToIPFS",
        data: {
          "name": name,
          "description": desc,
          "image": ImgHash
        },
        headers: {
          'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
          'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_API_KEY,
        },
      });

      const tokenURI = `https://gateway.pinata.cloud/ipfs/${resJSON.data.IpfsHash}`;
      console.log("Token URI", tokenURI);
      mintThenList(tokenURI);
    } catch (error) {
      console.log("JSON to IPFS: ", error);
    }
  }

  const sendFileToIPFS = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!fileImg) newErrors.fileImg = "File is required.";
    if (!name) newErrors.name = "Name is required.";
    if (!desc) newErrors.desc = "Description is required.";
    if (!price) newErrors.price = "Price is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      const formData = new FormData();
      formData.append("file", fileImg);
      console.log(formData);
      const resFile = await axios({
        method: "post",
        url: "https://api.pinata.cloud/pinning/pinFileToIPFS",
        data: formData,
        headers: {
          'pinata_api_key': process.env.REACT_APP_PINATA_API_KEY,
          'pinata_secret_api_key': process.env.REACT_APP_PINATA_SECRET_API_KEY,
          "Content-Type": "multipart/form-data"
        },
      });

      const ImgHash = `https://gateway.pinata.cloud/ipfs/${resFile.data.IpfsHash}`;
      console.log(ImgHash);
      sendJSONtoIPFS(ImgHash);
    } catch (error) {
      console.log("File to IPFS: ", error);
    }
  }

  const mintThenList = async (uri) => {
    await (await nft.mint(uri)).wait();
    const id = await nft.tokenCount();
    await (await nft.setApprovalForAll(marketplace.address, true)).wait();
    const listingPrice = ethers.utils.parseEther(price.toString());
    await (await marketplace.makeItem(nft.address, id, listingPrice)).wait();
    navigate('/');
  }

  return (
    <div className="container-fluid mt-5">
      <div className="row">
        <main role="main" className="col-lg-12 mx-auto" style={{ maxWidth: '1000px' }}>
          <div className="content mx-auto">
            <Row className="g-4">
              <Form.Control onChange={(e) => setFile(e.target.files[0])} size="lg" required type="file" name="file" />
              {errors.fileImg && <Alert variant="danger">{errors.fileImg}</Alert>}
              <Form.Control onChange={(e) => setName(e.target.value)} size="lg" required type="text" placeholder="Name" />
              {errors.name && <Alert variant="danger">{errors.name}</Alert>}
              <Form.Control onChange={(e) => setDescription(e.target.value)} size="lg" required as="textarea" placeholder="Description" />
              {errors.desc && <Alert variant="danger">{errors.desc}</Alert>}
              <Form.Control onChange={(e) => setPrice(e.target.value)} size="lg" required type="number" placeholder="Price in ETH" />
              {errors.price && <Alert variant="danger">{errors.price}</Alert>}
              <div className="d-grid px-0">
                <Button onClick={sendFileToIPFS} variant="success" size="lg">
                  Create & List NFT!
                </Button>
              </div>
            </Row>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Create;
