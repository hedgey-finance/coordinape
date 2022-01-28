import { Signer, BigNumberish, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { ApeUgradeableBeacon, ApeUgradeableBeaconInterface } from "../ApeUgradeableBeacon";
export declare class ApeUgradeableBeacon__factory extends ContractFactory {
    constructor(signer?: Signer);
    deploy(_apeVault: string, _minDelay: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ApeUgradeableBeacon>;
    getDeployTransaction(_apeVault: string, _minDelay: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): TransactionRequest;
    attach(address: string): ApeUgradeableBeacon;
    connect(signer: Signer): ApeUgradeableBeacon__factory;
    static readonly bytecode = "0x608060405234801561001057600080fd5b50604051610da0380380610da083398101604081905261002f91610150565b808261003a3361004f565b6100438161009f565b50600355506101889050565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6100b28161014a60201b61071d1760201c565b6101285760405162461bcd60e51b815260206004820152603360248201527f5570677261646561626c65426561636f6e3a20696d706c656d656e746174696f60448201527f6e206973206e6f74206120636f6e747261637400000000000000000000000000606482015260840160405180910390fd5b600180546001600160a01b0319166001600160a01b0392909216919091179055565b3b151590565b60008060408385031215610162578182fd5b82516001600160a01b0381168114610178578283fd5b6020939093015192949293505050565b610c09806101976000396000f3fe608060405234801561001057600080fd5b50600436106100ba5760003560e01c80631333cdda146100bf5780632a9eda11146100e75780632c5eaf21146100fa5780633659cfe61461010f5780634c84c5a1146101225780635c60da1b14610135578063715018a61461015a5780638da5cb5b146101625780639749b3681461016a578063abeb69971461017d578063b587295814610190578063c4d252f5146101be578063c63c4e9b146101d1578063f2fde38b146101da575b600080fd5b6100d26100cd366004610a7a565b6101ed565b60405190151581526020015b60405180910390f35b6100d26100f5366004610a7a565b610205565b61010d6101083660046109e6565b61021a565b005b61010d61011d3660046109c5565b61037b565b6100d2610130366004610a7a565b6103a6565b6001546001600160a01b03165b6040516001600160a01b0390911681526020016100de565b61010d6103bb565b6101426103f6565b61010d610178366004610a7a565b610405565b61010d61018b3660046109e6565b610429565b6101b061019e366004610a7a565b60026020526000908152604090205481565b6040519081526020016100de565b61010d6101cc366004610a7a565b6105ae565b6101b060035481565b61010d6101e83660046109c5565b610680565b6000818152600260205260409020544210155b919050565b60009081526002602052604090205460011490565b336102236103f6565b6001600160a01b0316146102525760405162461bcd60e51b815260040161024990610b7a565b60405180910390fd5b60006102618787878787610723565b600081815260026020526040902054909150156102c05760405162461bcd60e51b815260206004820181905260248201527f54696d654c6f636b3a2043616c6c20616c7265616479207363686564756c65646044820152606401610249565b6003548210156103115760405162461bcd60e51b815260206004820152601c60248201527b54696d654c6f636b3a20496e73756666696369656e742064656c617960201b6044820152606401610249565b60035461031e9042610baf565b60008281526002602052604090819020919091555181907f66dcc96f6c92c7919714879a908fc29b273e363ba3d409c0c6db86984ee3c4809061036a908a908a908a908a908990610afa565b60405180910390a250505050505050565b33301461039a5760405162461bcd60e51b815260040161024990610b33565b6103a38161075f565b50565b60009081526002602052604090205460011090565b336103c46103f6565b6001600160a01b0316146103ea5760405162461bcd60e51b815260040161024990610b7a565b6103f460006107ce565b565b6000546001600160a01b031690565b3330146104245760405162461bcd60e51b815260040161024990610b33565b600355565b336104326103f6565b6001600160a01b0316146104585760405162461bcd60e51b815260040161024990610b7a565b60006104678787878787610723565b9050610472816101ed565b6104c85760405162461bcd60e51b815260206004820152602160248201527f54696d654c6f636b3a204e6f7420726561647920666f7220657865637574696f6044820152603760f91b6064820152608401610249565b6104d181610205565b1561051b5760405162461bcd60e51b815260206004820152601a602482015279151a5b59531bd8dace88105b1c9958591e48195e1958dd5d195960321b6044820152606401610249565b83158061052c575061052c84610205565b6105885760405162461bcd60e51b815260206004820152602760248201527f54696d654c6f636b3a205072656465636573736f722063616c6c206e6f7420656044820152661e1958dd5d195960ca1b6064820152608401610249565b6105948188888861081e565b600090815260026020526040902060019055505050505050565b336105b76103f6565b6001600160a01b0316146105dd5760405162461bcd60e51b815260040161024990610b7a565b6105e6816103a6565b6106325760405162461bcd60e51b815260206004820152601d60248201527f54696d654c6f636b3a2043616c6c206973206e6f742070656e64696e670000006044820152606401610249565b60008181526002602052604080822091909155517fab2af3494bc00bd4aa34e08bd246e5c402d3ee4856c19f5461ce47a6d57423e1906106759083815260200190565b60405180910390a150565b336106896103f6565b6001600160a01b0316146106af5760405162461bcd60e51b815260040161024990610b7a565b6001600160a01b0381166107145760405162461bcd60e51b815260206004820152602660248201527f4f776e61626c653a206e6577206f776e657220697320746865207a65726f206160448201526564647265737360d01b6064820152608401610249565b6103a3816107ce565b3b151590565b6000858585858560405160200161073e959493929190610afa565b60405160208183030381529060405280519060200120905095945050505050565b336107686103f6565b6001600160a01b03161461078e5760405162461bcd60e51b815260040161024990610b7a565b61079781610922565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b600080546001600160a01b038381166001600160a01b0319831681178455604051919092169283917f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e09190a35050565b6000836001600160a01b0316838360405161083a929190610abc565b6000604051808303816000865af19150503d8060008114610877576040519150601f19603f3d011682016040523d82523d6000602084013e61087c565b606091505b50509050806108df5760405162461bcd60e51b815260206004820152602960248201527f54696d656c6f636b3a20756e6465726c79696e67207472616e73616374696f6e604482015268081c995d995c9d195960ba1b6064820152608401610249565b847fc08872e260006100fd2e00a3ba4c617fdb250f802f99384d55c10097dc1d048785858560405161091393929190610acc565b60405180910390a25050505050565b803b61098c5760405162461bcd60e51b815260206004820152603360248201527f5570677261646561626c65426561636f6e3a20696d706c656d656e746174696f6044820152721b881a5cc81b9bdd08184818dbdb9d1c9858dd606a1b6064820152608401610249565b600180546001600160a01b0319166001600160a01b0392909216919091179055565b80356001600160a01b038116811461020057600080fd5b6000602082840312156109d6578081fd5b6109df826109ae565b9392505050565b60008060008060008060a087890312156109fe578182fd5b610a07876109ae565b955060208701356001600160401b0380821115610a22578384fd5b818901915089601f830112610a35578384fd5b813581811115610a43578485fd5b8a6020828501011115610a54578485fd5b979a60209290920199509697604081013597506060810135965060800135945092505050565b600060208284031215610a8b578081fd5b5035919050565b60008284528282602086013780602084860101526020601f19601f85011685010190509392505050565b6000828483379101908152919050565b6001600160a01b0384168152604060208201819052600090610af19083018486610a92565b95945050505050565b6001600160a01b0386168152608060208201819052600090610b1f9083018688610a92565b604083019490945250606001529392505050565b60208082526027908201527f54696d654c6f636b3a2043616c6c6572206973206e6f7420636f6e74726163746040820152661034ba39b2b63360c91b606082015260800190565b6020808252818101527f4f776e61626c653a2063616c6c6572206973206e6f7420746865206f776e6572604082015260600190565b60008219821115610bce57634e487b7160e01b81526011600452602481fd5b50019056fea26469706673582212205522bce143287f0f6075a15fb0bd0c2f611606d7b8ca03a0fc30af7fe218bbd264736f6c63430008020033";
    static readonly abi: ({
        inputs: {
            internalType: string;
            name: string;
            type: string;
        }[];
        stateMutability: string;
        type: string;
        anonymous?: undefined;
        name?: undefined;
        outputs?: undefined;
    } | {
        anonymous: boolean;
        inputs: {
            indexed: boolean;
            internalType: string;
            name: string;
            type: string;
        }[];
        name: string;
        type: string;
        stateMutability?: undefined;
        outputs?: undefined;
    } | {
        inputs: {
            internalType: string;
            name: string;
            type: string;
        }[];
        name: string;
        outputs: {
            internalType: string;
            name: string;
            type: string;
        }[];
        stateMutability: string;
        type: string;
        anonymous?: undefined;
    })[];
    static createInterface(): ApeUgradeableBeaconInterface;
    static connect(address: string, signerOrProvider: Signer | Provider): ApeUgradeableBeacon;
}
