import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const useProxy = !hre.network.live;
  const yRegistry = await deploy('MockRegistry', {
    contract: 'MockRegistry',
    from: deployer,
    args: [],
    log: true,
  });
  await deploy('MockVaultFactory', {
    contract: 'MockVaultFactory',
    from: deployer,
    args: [yRegistry.address],
    log: true,
  });
  return !useProxy;
};
export default func;
func.id = 'deploy_mock_yearn_protocol';
func.tags = ['DeployMockYearn', 'MockYearn'];
