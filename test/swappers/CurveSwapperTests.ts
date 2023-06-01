import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {expect} from "chai";
import { BigNumber } from "ethers";
import {
  Controller,
  CurveSwapper,
  ICurveLpToken__factory, IERC20__factory,
  MockToken,
} from "../../typechain";
import {formatUnits, parseUnits} from "ethers/lib/utils";
import {TimeUtils} from "../TimeUtils";
import {DeployerUtils} from "../../scripts/utils/DeployerUtils";
import {Misc} from "../../scripts/utils/Misc";

const hre = require("hardhat");

describe("CurveSwapperTests", function () {
  let snapshotBefore: string;
  let snapshot: string;
  let signer: SignerWithAddress;
  let signer2: SignerWithAddress;
  let controller: Controller;
  let swapper: CurveSwapper;
  let wrongToken: MockToken;

  const usdDecimals = 6;
  const oneUSD = parseUnits('1', usdDecimals);

  const am3CRV = '0xE7a24EF0C5e95Ffb0f6684b813A78F2a3AD7D171';
  const amUSDT = '0x60D55F02A771d515e077c9C2403a1ef324885CeC';
  const amUSDC = '0x1a13F4Ca1d028320A707D99520AbFefca3998b7F';
  const amDAI = '0x27F8D03b3a2196956ED754baDc28D73be8830A6e';

  const EURT_am3CRV = '0x600743B1d8A96438bD46836fD34977a00293f6Aa';
  const EURT = '0x7BDF330f423Ea880FF95fC41A280fD5eCFD3D09f';

  const USDR_am3CRV = '0xa138341185a9D0429B0021A11FB717B225e13e1F';
  const USDR = '0xb5DFABd7fF7F83BAB83995E72A52B97ABb7bcf63';

  before(async function () {
    snapshotBefore = await TimeUtils.snapshot();
    [signer, signer2] = await ethers.getSigners();
    controller = await DeployerUtils.deployController(signer);

    swapper = await DeployerUtils.deployCurveSwapper(signer, controller.address);

    // token for testing wrong tokens
    wrongToken = await DeployerUtils.deployMockToken(signer, 'WTOKEN');
  });

  after(async function () {
    await TimeUtils.rollback(snapshotBefore);
  });


  beforeEach(async function () {
    snapshot = await TimeUtils.snapshot();
  });

  afterEach(async function () {
    await TimeUtils.rollback(snapshot);
  });

  it("get price tokenIn revert", async () => {
    await expect(
        swapper.getPrice(am3CRV, wrongToken.address, amUSDC, oneUSD)
    ).revertedWith('Wrong tokenIn');
  });

  it("get price tokenOut revert", async () => {
    await expect(
        swapper.getPrice(am3CRV, amUSDC, wrongToken.address, oneUSD)
    ).revertedWith('Wrong tokenOut');
  });

  it("get tokens index", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }
    const minter = await ICurveLpToken__factory.connect(am3CRV, signer).minter();

    const indexes = await swapper.getTokensIndex(
        minter,
        amUSDT,
        amUSDC
    );
    expect(indexes.tokenInIndex).to.equal(BigNumber.from('2'));
    expect(indexes.tokenOutIndex).to.equal(BigNumber.from('1'));

    const indexes2 = await swapper.getTokensIndex(
        minter,
        amUSDC,
        amDAI
    );
    expect(indexes2.tokenInIndex).to.equal(BigNumber.from('1'));
    expect(indexes2.tokenOutIndex).to.equal(BigNumber.from('0'));
  });

  it("from amUSDC to amDAI get price from 3CRV and check int128 values", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }

    const price = +formatUnits(await swapper.getPrice(
        am3CRV,
        amUSDT,
        amUSDC,
        parseUnits('1', 6)
    ), 6);
    console.log(price);
    expect(price).approximately(1, 0.2);

    const price2 = +formatUnits(await swapper.getPrice(
        am3CRV,
        amUSDC,
        amDAI,
        oneUSD
    ), 18)
    console.log(price2);
    expect(price2).approximately(1, 0.2)
  });

  it("from EURT to am3CRV get price from EURT_am3CRV and check uint256 values", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }
    const price = +formatUnits(await swapper.getPrice(
        EURT_am3CRV,
        am3CRV,
        EURT,
        parseUnits('1', 18)
    ), 6)
    console.log(price);
    expect(price).approximately(1, 0.3);
  });

  it("from USDR to am3CRV get price from USDR_am3CRV and check not minter pool", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }
    const price = +formatUnits(await swapper.getPrice(
        USDR_am3CRV,
        USDR,
        am3CRV,
        parseUnits('1', 9)
    ), 18)
    console.log(price);
    expect(price).approximately(1, 0.3);
  });

  it("swap amUSDT -> amUSDC in am3CRV and check int128 values", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }

    const amount = parseUnits('1', 6);
    const amUsdtHolder = await Misc.impersonate('0x510d0e4def20c6bfd84f080bc424bac5c66941f4')
    await IERC20__factory.connect(amUSDT, amUsdtHolder).transfer(swapper.address, amount)

    const beforeBalance = await IERC20__factory.connect(amUSDC,signer).balanceOf(signer.address);
    expect(beforeBalance).to.equal(BigNumber.from('0'));

    await swapper.swap(
        am3CRV,
        amUSDT,
        amUSDC,
        signer.address,
        10
    );
    const afterBalance = +formatUnits(
        await IERC20__factory.connect(amUSDC,signer).balanceOf(signer.address)
    , 6);
    console.log(afterBalance);
    expect(afterBalance).approximately(1, 0.2);
  });

  it("swap USDR -> am3CRV in USDR_am3CRV", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }

    const amount = parseUnits('1', 9);
    const amUsdrHolder = await Misc.impersonate('0x76f49de0c05cb7e2d0a08a0d9d12907d508fa88d')
    await IERC20__factory.connect(USDR, amUsdrHolder).transfer(swapper.address, amount)

    const beforeBalance = await IERC20__factory.connect(am3CRV,signer).balanceOf(signer.address);
    expect(beforeBalance).to.equal(BigNumber.from('0'));

    await swapper.swap(
        USDR_am3CRV,
        USDR,
        am3CRV,
        signer.address,
        10
    );
    const afterBalance = +formatUnits(
        await IERC20__factory.connect(am3CRV,signer).balanceOf(signer.address)
        , 18);
    console.log(afterBalance);
    expect(afterBalance).approximately(1, 0.2);
  });

  it("swap EURT -> am3CRV and check uint256 values", async () => {
    if(hre.network.config.chainId !== 137) {
      return;
    }

    const amount = parseUnits('1', 6);
    const eURTHolder = await Misc.impersonate('0x50b3e08d5c3a2386e0c9585031b1152a5f0e2370')
    await IERC20__factory.connect(EURT, eURTHolder).transfer(swapper.address, amount)

    const beforeBalance = await IERC20__factory.connect(am3CRV,signer2).balanceOf(signer2.address);
    expect(beforeBalance).to.equal(BigNumber.from('0'));

    await swapper.swap(
        EURT_am3CRV,
        EURT,
        am3CRV,
        signer2.address,
        50
    );
    const afterBalance = +formatUnits(
        await IERC20__factory.connect(am3CRV,signer2).balanceOf(signer2.address)
        , 18);
    console.log(afterBalance);
    expect(afterBalance).approximately(1, 0.2);
  });

});
