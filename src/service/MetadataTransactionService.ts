/*
 * Copyright 2018 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Convert } from '../core/format/Convert';
import { MetadataRepository } from '../infrastructure/MetadataRepository';
import { Address } from '../model/account/Address';
import { Metadata } from '../model/metadata/Metadata';
import { MetadataType } from '../model/metadata/MetadataType';
import { MosaicId } from '../model/mosaic/MosaicId';
import { NamespaceId } from '../model/namespace/NamespaceId';
import { NetworkType } from '../model/network/NetworkType';
import { AccountMetadataTransaction } from '../model/transaction/AccountMetadataTransaction';
import { Deadline } from '../model/transaction/Deadline';
import { MosaicMetadataTransaction } from '../model/transaction/MosaicMetadataTransaction';
import { NamespaceMetadataTransaction } from '../model/transaction/NamespaceMetadataTransaction';
import { UInt64 } from '../model/UInt64';
import { UnresolvedMosaicId } from '../model/mosaic/UnresolvedMosaicId';

/**
 * MetadataTransaction service
 */
export class MetadataTransactionService {
    /**
     * Constructor
     * @param metadataRepository
     */
    constructor(private readonly metadataRepository: MetadataRepository) {}

    /**
     * Create a Metadata Transaction object without knowing previous metadata value
     * @param deadline - Deadline
     * @param networkType - Network identifier
     * @param metadataType - Matadata type
     * @param targetAddress - Target address
     * @param key - Metadata scoped key
     * @param value - New metadata value
     * @param sourceAddress - sender (signer) address
     * @param targetId - Target Id (UnresolvedMosaicId)
     * @param maxFee - Max fee
     * @return {AccountMetadataTransaction | MosaicMetadataTransaction | NamespaceMetadataTransaction}
     */
    public createMetadataTransaction(
        deadline: Deadline,
        networkType: NetworkType,
        metadataType: MetadataType,
        targetAddress: Address,
        key: UInt64,
        value: string,
        sourceAddress: Address,
        targetId?: UnresolvedMosaicId,
        maxFee: UInt64 = new UInt64([0, 0]),
    ): Observable<AccountMetadataTransaction | MosaicMetadataTransaction | NamespaceMetadataTransaction> {
        switch (metadataType) {
            case MetadataType.Account:
                return this.createAccountMetadataTransaction(deadline, networkType, targetAddress, key, value, sourceAddress, maxFee);
            case MetadataType.Mosaic:
                if (!targetId || !(targetId instanceof MosaicId)) {
                    throw Error('TargetId for MosaicMetadataTransaction is invalid');
                }
                return this.createMosaicMetadataTransaction(
                    deadline,
                    networkType,
                    targetAddress,
                    targetId as MosaicId,
                    key,
                    value,
                    sourceAddress,
                    maxFee,
                );
            case MetadataType.Namespace:
                if (!targetId || !(targetId instanceof NamespaceId)) {
                    throw Error('TargetId for NamespaceMetadataTransaction is invalid');
                }
                return this.createNamespaceMetadataTransaction(
                    deadline,
                    networkType,
                    targetAddress,
                    targetId as NamespaceId,
                    key,
                    value,
                    sourceAddress,
                    maxFee,
                );
            default:
                throw Error('Metadata type invalid');
        }
    }

    /**
     * @internal
     * @param deadline - Deadline
     * @param networkType - Network identifier
     * @param targetAddress - Target address
     * @param key - Metadata key
     * @param value - New metadata value
     * @param sourceAddress - sender (signer) address
     * @param maxFee - max fee
     * @returns {Observable<AccountMetadataTransaction>}
     */
    private createAccountMetadataTransaction(
        deadline: Deadline,
        networkType: NetworkType,
        targetAddress: Address,
        key: UInt64,
        value: string,
        sourceAddress: Address,
        maxFee: UInt64,
    ): Observable<AccountMetadataTransaction> {
        return this.metadataRepository.getAccountMetadataByKeyAndSender(targetAddress, key.toHex(), sourceAddress).pipe(
            map((metadata: Metadata) => {
                const currentValueByte = Convert.utf8ToUint8(metadata.metadataEntry.value);
                const newValueBytes = Convert.utf8ToUint8(value);
                return AccountMetadataTransaction.create(
                    deadline,
                    targetAddress,
                    key,
                    newValueBytes.length - currentValueByte.length,
                    Convert.decodeHex(Convert.xor(currentValueByte, newValueBytes)),
                    networkType,
                    maxFee,
                );
            }),
            catchError((err: Error) => {
                const error = JSON.parse(err.message);
                if (error && error.statusCode && error.statusCode === 404) {
                    const newValueBytes = Convert.utf8ToUint8(value);
                    return of(
                        AccountMetadataTransaction.create(deadline, targetAddress, key, newValueBytes.length, value, networkType, maxFee),
                    );
                }
                throw Error(err.message);
            }),
        );
    }

    /**
     * @internal
     * @param deadline - Deadline
     * @param networkType - Network identifier
     * @param targetAddress - Target Address
     * @param mosaicId - Mosaic Id
     * @param key - Metadata key
     * @param value - New metadata value
     * @param sourceAddress - sender (signer) address
     * @param maxFee - max fee
     * @returns {Observable<MosaicMetadataTransaction>}
     */
    private createMosaicMetadataTransaction(
        deadline: Deadline,
        networkType: NetworkType,
        targetAddress: Address,
        mosaicId: MosaicId,
        key: UInt64,
        value: string,
        sourceAddress: Address,
        maxFee: UInt64,
    ): Observable<MosaicMetadataTransaction> {
        return this.metadataRepository.getMosaicMetadataByKeyAndSender(mosaicId, key.toHex(), sourceAddress).pipe(
            map((metadata: Metadata) => {
                const currentValueByte = Convert.utf8ToUint8(metadata.metadataEntry.value);
                const newValueBytes = Convert.utf8ToUint8(value);
                return MosaicMetadataTransaction.create(
                    deadline,
                    targetAddress,
                    key,
                    mosaicId,
                    newValueBytes.length - currentValueByte.length,
                    Convert.decodeHex(Convert.xor(currentValueByte, newValueBytes)),
                    networkType,
                    maxFee,
                );
            }),
            catchError((err: Error) => {
                const error = JSON.parse(err.message);
                if (error && error.statusCode && error.statusCode === 404) {
                    const newValueBytes = Convert.utf8ToUint8(value);
                    return of(
                        MosaicMetadataTransaction.create(
                            deadline,
                            targetAddress,
                            key,
                            mosaicId,
                            newValueBytes.length,
                            value,
                            networkType,
                            maxFee,
                        ),
                    );
                }
                throw Error(err.message);
            }),
        );
    }

    /**
     * @internal
     * @param deadline - Deadline
     * @param networkType - Network identifier
     * @param targetAddress - Target address
     * @param namespaceId - Namespace Id
     * @param key - Metadata key
     * @param value - New metadata value
     * @param sourceAddress - sender (signer) address
     * @param maxFee - max fee
     * @returns {Observable<NamespaceMetadataTransaction>}
     */
    private createNamespaceMetadataTransaction(
        deadline: Deadline,
        networkType: NetworkType,
        targetAddress: Address,
        namespaceId: NamespaceId,
        key: UInt64,
        value: string,
        sourceAddress: Address,
        maxFee: UInt64,
    ): Observable<NamespaceMetadataTransaction> {
        return this.metadataRepository.getNamespaceMetadataByKeyAndSender(namespaceId, key.toHex(), sourceAddress).pipe(
            map((metadata: Metadata) => {
                const currentValueByte = Convert.utf8ToUint8(metadata.metadataEntry.value);
                const newValueBytes = Convert.utf8ToUint8(value);
                return NamespaceMetadataTransaction.create(
                    deadline,
                    targetAddress,
                    key,
                    namespaceId,
                    newValueBytes.length - currentValueByte.length,
                    Convert.decodeHex(Convert.xor(currentValueByte, newValueBytes)),
                    networkType,
                    maxFee,
                );
            }),
            catchError((err: Error) => {
                const error = JSON.parse(err.message);
                if (error && error.statusCode && error.statusCode === 404) {
                    const newValueBytes = Convert.utf8ToUint8(value);
                    return of(
                        NamespaceMetadataTransaction.create(
                            deadline,
                            targetAddress,
                            key,
                            namespaceId,
                            newValueBytes.length,
                            value,
                            networkType,
                            maxFee,
                        ),
                    );
                }
                throw Error(err.message);
            }),
        );
    }
}
